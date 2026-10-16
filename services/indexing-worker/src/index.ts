import { handleIndexing } from './consumer'
import { handleDeadLetters } from './dead-letters'
import type { WorkerEnv } from './env'
import { sweepOrphans } from './orphans'
import { sweepOutbox } from './sweep'

export { Processor } from './processor'

export default {
	async queue(batch, env) {
		if (batch.queue === 'indexing-dlq') {
			await handleDeadLetters(batch, env)
		} else {
			await handleIndexing(batch, env)
		}
	},
	async scheduled(controller, env) {
		if (controller.cron === '0 3 * * *') {
			await sweepOrphans(env)
		} else {
			await sweepOutbox(env)
		}
	},
} satisfies ExportedHandler<WorkerEnv>
