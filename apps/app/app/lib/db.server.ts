import { PrismaPg } from '@prisma/adapter-pg'
import { environmentVariables } from './actions/env.server'
import { PrismaClient } from '~/generated/prisma/client'

declare global {
	var __prisma: PrismaClient | undefined
}

function createClient() {
	const { DATABASE_URL, NODE_ENV } = environmentVariables()
	if (!DATABASE_URL) {
		throw new Error(
			'DATABASE_URL is not set. Add it to .env (see .env.example).',
		)
	}
	return new PrismaClient({
		adapter: new PrismaPg({ connectionString: DATABASE_URL }),
		log: NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
	})
}

/**
 * The shared Prisma client, created on first use. Development reuses one
 * instance across hot reloads so each edit does not open a new pool.
 * Server-only: never import this from a component.
 */
export function db() {
	if (globalThis.__prisma) return globalThis.__prisma
	const client = createClient()
	if (environmentVariables().NODE_ENV !== 'production')
		globalThis.__prisma = client
	return client
}
