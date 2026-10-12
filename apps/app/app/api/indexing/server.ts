import type { Prisma } from '~/generated/prisma/client'
import { environmentVariables } from '~/lib/actions/env.server'
import { db } from '~/lib/db.server'

export interface IndexRequestedMessage {
	event_id: string
	organization_id: string
	document_id: string
	document_version_id: string
	indexing_job_id: string
}

type StoredPayload = Omit<IndexRequestedMessage, 'event_id'>

export async function enqueueIndexing(
	tx: Prisma.TransactionClient,
	input: {
		organizationId: string
		documentId: string
		documentVersionId: string
		trigger: 'UPLOAD' | 'RETRY'
		actorId: string | null
	},
) {
	const job = await tx.indexingJob.create({
		data: {
			organizationId: input.organizationId,
			documentVersionId: input.documentVersionId,
			triggeredBy: input.trigger,
			createdById: input.actorId,
		},
	})
	const payload: StoredPayload = {
		organization_id: input.organizationId,
		document_id: input.documentId,
		document_version_id: input.documentVersionId,
		indexing_job_id: job.id,
	}
	const event = await tx.outboxEvent.create({
		data: {
			organizationId: input.organizationId,
			eventType: 'document.index_requested',
			aggregateId: job.id,
			payload: { ...payload },
		},
	})
	return { jobId: job.id, eventId: event.id }
}

async function publishToQueue(
	message: IndexRequestedMessage,
	fetchImpl: typeof fetch,
) {
	const env = environmentVariables()
	if (
		!env.CLOUDFLARE_ACCOUNT_ID ||
		!env.CLOUDFLARE_API_TOKEN ||
		!env.INDEXING_QUEUE_ID
	) {
		throw new Error('Cloudflare Queues is not configured')
	}
	const response = await fetchImpl(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/queues/${env.INDEXING_QUEUE_ID}/messages`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ body: message, content_type: 'json' }),
			signal: AbortSignal.timeout(5000),
		},
	)
	if (!response.ok) throw new Error(`Queues API ${response.status}`)
}

/**
 * Sends an outbox event after its transaction commits. Failures are recorded
 * and left for the Worker's sweep, so this never throws.
 */
export async function dispatchIndexing(
	eventId: string,
	fetchImpl: typeof fetch = fetch,
) {
	try {
		const env = environmentVariables()
		const event = await db().outboxEvent.findUnique({ where: { id: eventId } })
		if (!event || event.publishedAt) return
		const message: IndexRequestedMessage = {
			event_id: event.id,
			...(event.payload as unknown as StoredPayload),
		}
		const mode =
			env.INDEXING_DISPATCH ??
			(env.NODE_ENV === 'production' ? 'queue' : 'direct')
		try {
			if (mode === 'queue') {
				await publishToQueue(message, fetchImpl)
			} else {
				// The local processor answers only when the job ends, so don't wait for it.
				void fetchImpl(env.PROCESSOR_URL, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(message),
				}).catch((error: unknown) =>
					console.warn('[indexing] local processor unreachable', String(error)),
				)
			}
			await db().outboxEvent.updateMany({
				where: { id: event.id, publishedAt: null },
				data: {
					publishedAt: new Date(),
					attempts: { increment: 1 },
					lastError: null,
				},
			})
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error)
			console.error('[indexing] publish failed', { eventId, reason })
			await db().outboxEvent.updateMany({
				where: { id: event.id, publishedAt: null },
				data: { attempts: { increment: 1 }, lastError: reason },
			})
		}
	} catch (error) {
		console.error('[indexing] dispatch bookkeeping failed', {
			eventId,
			reason: error instanceof Error ? error.message : String(error),
		})
	}
}
