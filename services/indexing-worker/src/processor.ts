import { Container } from '@cloudflare/containers'

import type { WorkerEnv } from './env'

export class Processor extends Container<WorkerEnv> {
	defaultPort = 8080
	sleepAfter = '1m'
	pingEndpoint = 'container/healthz'

	constructor(ctx: DurableObjectState<{}>, env: WorkerEnv) {
		super(ctx, env)
		this.envVars = {
			DATABASE_URL: env.PROCESSOR_DATABASE_URL,
			R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
			R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
			R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
			R2_BUCKET: env.R2_BUCKET,
			GEMINI_API_KEY: env.GEMINI_API_KEY,
			GEMINI_BASE_URL: env.GEMINI_BASE_URL,
			AI_GATEWAY_TOKEN: env.AI_GATEWAY_TOKEN,
			EMBEDDING_MODEL: env.EMBEDDING_MODEL,
			OCR_MODEL: env.OCR_MODEL,
			OCR_MONTHLY_PAGE_LIMIT: env.OCR_MONTHLY_PAGE_LIMIT,
			PIPELINE_VERSION: env.PIPELINE_VERSION,
		}
	}
}
