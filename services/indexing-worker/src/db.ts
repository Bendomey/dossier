import { Client } from 'pg'

import type { WorkerEnv } from './env'

export async function withClient<T>(
	env: WorkerEnv,
	fn: (client: Client) => Promise<T>,
): Promise<T> {
	const client = new Client({ connectionString: env.HYPERDRIVE.connectionString })
	await client.connect()
	try {
		return await fn(client)
	} finally {
		await client.end()
	}
}

export async function inTransaction<T>(
	client: Client,
	fn: () => Promise<T>,
): Promise<T> {
	await client.query('BEGIN')
	try {
		const result = await fn()
		await client.query('COMMIT')
		return result
	} catch (error) {
		await client.query('ROLLBACK')
		throw error
	}
}
