import type { Client } from 'pg'

import { inTransaction, withClient } from './db'
import type { WorkerEnv } from './env'
import { log, parseMessage, type IndexRequestedMessage } from './message'

interface OutboxRow {
	id: string
	payload: Record<string, unknown>
}

const PENDING = `
	SELECT id, payload FROM outbox_events
	WHERE event_type = 'document.index_requested'
	  AND published_at IS NULL AND created_at < now() - interval '1 minute'
	ORDER BY created_at
	LIMIT 100
	FOR UPDATE SKIP LOCKED`

// A processor that stops heartbeating died after its message was acked;
// requeueing counts as an attempt at the next claim, so a file that keeps
// crashing the processor ends RETRIES_EXHAUSTED instead of looping.
const REQUEUE_STALLED = `
	WITH stalled AS (
		SELECT j.id, j.organization_id, j.document_version_id, v.document_id
		FROM indexing_jobs j
		JOIN document_versions v ON v.id = j.document_version_id AND v.organization_id = j.organization_id
		WHERE j.status = 'PROCESSING' AND j.heartbeat_at < now() - interval '5 minutes'
		ORDER BY j.heartbeat_at
		LIMIT 50
		FOR UPDATE OF j SKIP LOCKED
	), requeued AS (
		UPDATE indexing_jobs j SET status = 'QUEUED'
		FROM stalled s
		WHERE j.id = s.id AND j.organization_id = s.organization_id
		RETURNING j.id, j.organization_id, s.document_id, s.document_version_id
	)
	INSERT INTO outbox_events (organization_id, event_type, aggregate_id, payload)
	SELECT organization_id, 'document.index_requested', id,
	       jsonb_build_object('organization_id', organization_id, 'document_id', document_id,
	                          'document_version_id', document_version_id, 'indexing_job_id', id)
	FROM requeued
	RETURNING id, payload`

// A job set back to QUEUED by a transient failure after its delivery was
// already acked has no message left; re-send it once nothing else has for 30
// minutes, longer than the longest queue retry gap plus one delivery.
const RESEND_ORPHANED = `
	WITH orphaned AS (
		SELECT j.id, j.organization_id, j.document_version_id, v.document_id
		FROM indexing_jobs j
		JOIN document_versions v ON v.id = j.document_version_id AND v.organization_id = j.organization_id
		WHERE j.status = 'QUEUED' AND j.attempts > 0
		  AND j.heartbeat_at < now() - interval '30 minutes'
		  AND NOT EXISTS (
		    SELECT 1 FROM outbox_events e
		    WHERE e.organization_id = j.organization_id AND e.aggregate_id = j.id
		      AND e.created_at > now() - interval '30 minutes')
		ORDER BY j.heartbeat_at
		LIMIT 50
		FOR UPDATE OF j SKIP LOCKED
	)
	INSERT INTO outbox_events (organization_id, event_type, aggregate_id, payload)
	SELECT organization_id, 'document.index_requested', id,
	       jsonb_build_object('organization_id', organization_id, 'document_id', document_id,
	                          'document_version_id', document_version_id, 'indexing_job_id', id)
	FROM orphaned
	RETURNING id, payload`

export async function sweepOutbox(env: WorkerEnv) {
	await withClient(env, async (client) => {
		const requeued = await client.query<OutboxRow>(REQUEUE_STALLED)
		if (requeued.rows.length > 0) {
			log('jobs_requeued', { count: requeued.rows.length })
			await publish(env, client, requeued.rows)
		}
		const resent = await client.query<OutboxRow>(RESEND_ORPHANED)
		if (resent.rows.length > 0) {
			log('jobs_resent', { count: resent.rows.length })
			await publish(env, client, resent.rows)
		}
		await inTransaction(client, async () => {
			const pending = await client.query<OutboxRow>(PENDING)
			if (pending.rows.length > 0) await publish(env, client, pending.rows)
		})
	})
}

async function publish(env: WorkerEnv, client: Client, rows: OutboxRow[]) {
	const messages: IndexRequestedMessage[] = []
	const ids: string[] = []
	const invalid: string[] = []
	for (const row of rows) {
		const message = parseMessage({ event_id: row.id, ...row.payload })
		if (message) {
			messages.push(message)
			ids.push(row.id)
		} else {
			invalid.push(row.id)
		}
	}
	if (invalid.length > 0) {
		await client.query(
			`UPDATE outbox_events SET attempts = attempts + 1, last_error = 'invalid payload' WHERE id = ANY($1::uuid[])`,
			[invalid],
		)
		log('outbox_invalid', { ids: invalid })
	}
	if (messages.length === 0) return
	try {
		await env.INDEXING_QUEUE.sendBatch(
			messages.map((body) => ({ body, contentType: 'json' as const })),
		)
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error)
		await client.query(
			`UPDATE outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = ANY($1::uuid[])`,
			[ids, reason.slice(0, 500)],
		)
		log('outbox_publish_failed', { count: ids.length, reason })
		return
	}
	await client.query(
		`UPDATE outbox_events SET published_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = ANY($1::uuid[])`,
		[ids],
	)
	log('outbox_published', { count: ids.length })
}
