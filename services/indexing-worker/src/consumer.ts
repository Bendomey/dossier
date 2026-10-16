import { getContainer } from '@cloudflare/containers'

import type { WorkerEnv } from './env'
import { log, parseMessage, type IndexRequestedMessage } from './message'

const POOL = ['processor-0', 'processor-1']
const REQUEST_TIMEOUT_MS = 13 * 60_000
const BUSY_DELAY_SECONDS = 30
const FAILURE_DELAYS_SECONDS = [30, 120, 600]
const LAST_DELAY_SECONDS = 600

type Delivery = 'done' | 'busy' | 'failed'

export async function handleIndexing(
	batch: MessageBatch<unknown>,
	env: WorkerEnv,
) {
	for (const message of batch.messages) {
		const body = parseMessage(message.body)
		if (!body) {
			log('invalid_message', { message_id: message.id })
			message.ack()
			continue
		}
		const delivery = await deliver(env, body)
		if (delivery === 'done') {
			message.ack()
		} else if (delivery === 'busy') {
			message.retry({ delaySeconds: BUSY_DELAY_SECONDS })
		} else {
			message.retry({
				delaySeconds:
					FAILURE_DELAYS_SECONDS[message.attempts - 1] ?? LAST_DELAY_SECONDS,
			})
		}
	}
}

// Each instance runs one job at a time and answers 429 while busy, so a busy
// instance sends the message to the other one before it goes back on the queue.
async function deliver(
	env: WorkerEnv,
	message: IndexRequestedMessage,
): Promise<Delivery> {
	const first = Math.floor(Math.random() * POOL.length)
	for (let i = 0; i < POOL.length; i++) {
		const instance = POOL[(first + i) % POOL.length]
		const started = Date.now()
		let response: Response
		let outcome: string
		try {
			response = await getContainer(env.PROCESSOR, instance).fetch(
				'http://container/jobs',
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(message),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				},
			)
			outcome = await response.text()
		} catch (error) {
			log('delivery_failed', {
				job_id: message.indexing_job_id,
				instance,
				reason: error instanceof Error ? error.name : 'unknown',
			})
			return 'failed'
		}
		log('delivered', {
			job_id: message.indexing_job_id,
			instance,
			status: response.status,
			outcome: outcome.slice(0, 200),
			duration_ms: Date.now() - started,
		})
		if (response.status === 429) continue
		return response.status === 200 || response.status === 422
			? 'done'
			: 'failed'
	}
	return 'busy'
}
