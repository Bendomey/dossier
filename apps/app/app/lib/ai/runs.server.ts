import { ModelError, type Usage } from './model/types'
import type { AiOperation, Prisma } from '~/generated/prisma/client'
import { db } from '~/lib/db.server'

export interface RunScope {
	organizationId: string
	userId: string
	chatId: string
	messageId: string
}

export interface RunDetails {
	usage?: Usage
	metadata?: Record<string, string | number | boolean>
}

export function errorCodeOf(error: unknown): string {
	if (error instanceof ModelError) return error.code
	if (error instanceof Error) {
		if (error.name === 'TimeoutError') return 'PROVIDER_UNAVAILABLE'
		if (error.name === 'AbortError') return 'CANCELLED'
		if (error.name === 'RetrievalError') return 'RETRIEVAL_FAILED'
	}
	return 'INTERNAL'
}

/** Records one model or retrieval call in ai_runs. Metadata must stay counts and IDs: never prompts, passages or answers. */
export async function trackRun<T>(
	scope: RunScope,
	operation: AiOperation,
	target: { provider: string; model: string },
	work: (record: (details: RunDetails) => void) => Promise<T>,
): Promise<T> {
	const startedAt = Date.now()
	const run = await db().aiRun.create({
		data: { ...scope, ...target, operation },
		select: { id: true },
	})
	let details: RunDetails = {}
	const record = (next: RunDetails) => {
		details = {
			usage: next.usage ?? details.usage,
			metadata: { ...details.metadata, ...next.metadata },
		}
	}
	const finish = (status: 'SUCCEEDED' | 'FAILED', errorCode?: string) =>
		db()
			.aiRun.update({
				where: { id: run.id },
				data: {
					status,
					errorCode,
					inputTokens: details.usage?.inputTokens,
					outputTokens: details.usage?.outputTokens,
					latencyMs: Date.now() - startedAt,
					metadata: (details.metadata ?? {}) as Prisma.InputJsonObject,
					completedAt: new Date(),
				},
			})
			.catch((error: unknown) =>
				console.error('Could not finish ai_run', error),
			)

	try {
		const result = await work(record)
		await finish('SUCCEEDED')
		return result
	} catch (error) {
		await finish('FAILED', errorCodeOf(error))
		throw error
	}
}
