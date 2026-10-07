import { config } from 'dotenv'
import * as z from 'zod'

config()

const environmentSchema = z.object({
	NODE_ENV: z
		.enum(['development', 'production', 'test', 'staging'])
		.default('development'),
	API_ADDRESS: z.string().min(1).default('http://localhost:5000/api'),
	GOOGLE_ANALYTICS_ID: z.string().default(''),
	GOOGLE_TRANSLATE_API_KEY: z.string().default(''),
})

const environmentVariables = () => environmentSchema.parse(process.env)

export { environmentVariables }
