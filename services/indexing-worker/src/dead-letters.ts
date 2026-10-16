import { withClient } from './db'
import type { WorkerEnv } from './env'
import { log, parseMessage } from './message'

// A job still heartbeating is running despite the lost message; anything else
// that never finished is failed so the person sees it and can retry.
const FAIL_JOB = `
	WITH failed AS (
		UPDATE indexing_jobs
		SET status = 'FAILED', error_code = 'RETRIES_EXHAUSTED', completed_at = now()
		WHERE id = $1::uuid AND organization_id = $2::uuid
		  AND status IN ('QUEUED', 'PROCESSING')
		  AND NOT (status = 'PROCESSING' AND heartbeat_at > now() - interval '2 minutes')
		RETURNING organization_id, document_version_id
	)
	INSERT INTO audit_logs (organization_id, action, resource_type, resource_id, metadata)
	SELECT f.organization_id, 'document.indexing_failed', 'document', v.document_id,
	       jsonb_build_object('target', v.file_name, 'version', v.version_number,
	                          'error_code', 'RETRIES_EXHAUSTED')
	FROM failed f
	JOIN document_versions v ON v.id = f.document_version_id AND v.organization_id = f.organization_id`

export async function handleDeadLetters(
	batch: MessageBatch<unknown>,
	env: WorkerEnv,
) {
	const handled = new Set<string>()
	try {
		await withClient(env, async (client) => {
			for (const message of batch.messages) {
				const body = parseMessage(message.body)
				if (!body) {
					log('dead_letter_invalid', { message_id: message.id })
					message.ack()
					handled.add(message.id)
					continue
				}
				try {
					const result = await client.query(FAIL_JOB, [
						body.indexing_job_id,
						body.organization_id,
					])
					log('dead_letter', {
						job_id: body.indexing_job_id,
						failed: (result.rowCount ?? 0) > 0,
					})
					message.ack()
					handled.add(message.id)
				} catch (error) {
					log('dead_letter_error', {
						job_id: body.indexing_job_id,
						reason: error instanceof Error ? error.message : String(error),
					})
					if (message.attempts >= 20) {
						log('dead_letter_last_attempt', { job_id: body.indexing_job_id })
					}
					message.retry({ delaySeconds: 60 })
					handled.add(message.id)
				}
			}
		})
	} catch (error) {
		log('dead_letter_unavailable', {
			count: batch.messages.length - handled.size,
			reason: error instanceof Error ? error.message : String(error),
		})
		for (const message of batch.messages) {
			if (!handled.has(message.id)) message.retry({ delaySeconds: 300 })
		}
	}
}
