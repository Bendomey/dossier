// Secrets are set with `wrangler secret put`, so `wrangler types` does not see them.
export interface Secrets {
	PROCESSOR_DATABASE_URL: string
	R2_ACCOUNT_ID: string
	R2_ACCESS_KEY_ID: string
	R2_SECRET_ACCESS_KEY: string
	GEMINI_API_KEY: string
	GEMINI_BASE_URL: string
	AI_GATEWAY_TOKEN: string
}

export type WorkerEnv = Env & Secrets
