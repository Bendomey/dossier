import type * as z from 'zod'

export interface ModelTurn {
	role: 'user' | 'model'
	text: string
}

export interface ModelRequest {
	model: string
	system: string
	turns: ModelTurn[]
	temperature?: number
	maxOutputTokens?: number
}

export interface Usage {
	inputTokens: number
	outputTokens: number
}

export type ModelEvent =
	| { type: 'text'; text: string }
	| { type: 'usage'; usage: Usage }
	| { type: 'finish'; reason: string }

export interface ModelAdapter {
	streamText(
		request: ModelRequest,
		signal: AbortSignal,
	): AsyncIterable<ModelEvent>
	generateJson<T>(
		request: ModelRequest,
		schema: z.ZodType<T>,
		signal: AbortSignal,
	): Promise<{ value: T; usage: Usage }>
	embedQuery(
		model: string,
		text: string,
		signal: AbortSignal,
	): Promise<number[]>
}

export type ModelErrorCode =
	| 'AI_DISABLED'
	| 'PROVIDER_UNAVAILABLE'
	| 'PROVIDER_BLOCKED'

export class ModelError extends Error {
	constructor(
		readonly code: ModelErrorCode,
		message: string,
	) {
		super(message)
		this.name = 'ModelError'
	}
}
