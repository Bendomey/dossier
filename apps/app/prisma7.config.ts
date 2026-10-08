import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/*
 * The CLI (migrate, studio, seed) needs a session connection: Supabase's
 * transaction pooler (DATABASE_URL, port 6543) cannot run migrations, so
 * DIRECT_URL takes precedence here. `prisma generate` needs neither.
 */
export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts',
	},
	datasource: {
		url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
	},
})
