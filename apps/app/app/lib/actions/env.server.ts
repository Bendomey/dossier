import { config } from 'dotenv'
import * as z from 'zod'

config()

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
})

const environmentVariables = () => environmentSchema.parse(process.env)

export { environmentVariables }
