import { config } from 'dotenv'
import * as z from 'zod'

config()

const blankAsUnset = (value: unknown) => (value === '' ? undefined : value)

const environmentSchema = z.object({
	NODE_ENV: z
		.enum(['development', 'production', 'test', 'staging'])
		.default('development'),
	API_ADDRESS: z.string().min(1).default('http://localhost:5000/api'),
	SESSION_SECRET: z.string().min(1).default('dev-only-session-secret'),
	/** Pooled runtime connection (Supabase transaction pooler, port 6543). */
	DATABASE_URL: z.string().optional(),
	SUPABASE_URL: z.string().optional(),
	/** Supabase's public client key (sb_publishable_..., or the legacy anon key). */
	SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
	/** Server-only (sb_secret_..., or the legacy service_role key). Used to send invitation emails. */
	SUPABASE_SECRET_KEY: z.string().optional(),
	/** Cloudflare R2 (S3 API). Without all four, uploads stay disabled. */
	R2_ACCOUNT_ID: z.string().optional(),
	R2_ACCESS_KEY_ID: z.string().optional(),
	R2_SECRET_ACCESS_KEY: z.string().optional(),
	R2_BUCKET: z.string().optional(),
	/** Publishing indexing requests to Cloudflare Queues over the REST API (production). */
	CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
	CLOUDFLARE_API_TOKEN: z.string().optional(),
	INDEXING_QUEUE_ID: z.string().optional(),
	/** `queue` publishes to Cloudflare Queues; `direct` posts to a processor on PROCESSOR_URL. Defaults to direct in development. */
	INDEXING_DISPATCH: z.preprocess(
		blankAsUnset,
		z.enum(['queue', 'direct']).optional(),
	),
	PROCESSOR_URL: z.string().default('http://localhost:8080/jobs'),
	UPLOADS_ENABLED: z.preprocess(blankAsUnset, z.stringbool().default(false)),
})

const environmentVariables = () => environmentSchema.parse(process.env)

export { environmentVariables }
