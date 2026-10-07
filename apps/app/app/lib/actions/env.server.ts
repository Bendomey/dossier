import { config } from 'dotenv'
import * as z from 'zod'

config()

const environmentSchema = z.object({
	NODE_ENV: z
		.enum(['development', 'production', 'test', 'staging'])
		.default('development'),
	API_ADDRESS: z.string().min(1).default('http://localhost:5000/api'),
	SESSION_SECRET: z.string().min(1).default('dev-only-session-secret'),
})

const environmentVariables = () => environmentSchema.parse(process.env)

export { environmentVariables }
