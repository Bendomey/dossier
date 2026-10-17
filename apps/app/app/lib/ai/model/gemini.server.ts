import * as z from 'zod'
import {
	ModelError,
	type ModelAdapter,
	type ModelRequest,
	type Usage,
} from './types'
import { environmentVariables } from '~/lib/actions/env.server'
import { readSse } from '~/lib/sse'

const EMBEDDING_DIMENSIONS = 1536
const RETRY_DELAYS_MS = [1000, 2000, 4000]
const BLOCKED_REASONS = new Set([
	'SAFETY',
	'RECITATION',
	'BLOCKLIST',
	'PROHIBITED_CONTENT',
	'SPII',
])

const responseSchema = z.object({
	candidates: z
		.array(
			z.object({
				content: z
					.object({
						parts: z
							.array(
								z.object({
									text: z.string().optional(),
									thought: z.boolean().optional(),
								}),
							)
							.optional(),
					})
					.optional(),
				finishReason: z.string().optional(),
			}),
		)
		.optional(),
	promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
	usageMetadata: z
		.object({
			promptTokenCount: z.number().optional(),
			candidatesTokenCount: z.number().optional(),
		})
		.optional(),
})

type GeminiResponse = z.infer<typeof responseSchema>

const embeddingSchema = z.object({
	embedding: z.object({ values: z.array(z.number()) }),
})

function settings() {
	const env = environmentVariables()
	if (!env.AI_ENABLED || !env.GEMINI_API_KEY) {
		throw new ModelError('AI_DISABLED', 'AI is not configured')
	}
	return {
		baseUrl: env.GEMINI_BASE_URL.replace(/\/+$/, ''),
		apiKey: env.GEMINI_API_KEY,
		gatewayToken: env.AI_GATEWAY_TOKEN,
	}
}

const sleep = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		const timer = setTimeout(resolve, ms)
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer)
				reject(signal.reason)
			},
			{ once: true },
		)
	})

/** Retries 429, 5xx and network errors, only before any response body is read. */
async function post(
	model: string,
	method: string,
	body: unknown,
	signal: AbortSignal,
) {
	const { baseUrl, apiKey, gatewayToken } = settings()
	const headers: Record<string, string> = {
		'content-type': 'application/json',
		'x-goog-api-key': apiKey,
	}
	if (gatewayToken) headers['cf-aig-authorization'] = `Bearer ${gatewayToken}`

	for (let attempt = 0; ; attempt++) {
		let response: Response | undefined
		try {
			response = await fetch(`${baseUrl}/v1beta/models/${model}:${method}`, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal,
			})
		} catch (error) {
			if (signal.aborted) throw error
		}
		if (response?.ok) return response

		const retryable =
			!response || response.status === 429 || response.status >= 500
		const delay = RETRY_DELAYS_MS[attempt]
		if (!retryable || delay === undefined) {
			const detail = response
				? `${response.status} ${(await response.text()).slice(0, 300)}`
				: 'network error'
			console.error(`Gemini ${model}:${method} failed: ${detail}`)
			throw new ModelError(
				'PROVIDER_UNAVAILABLE',
				`Gemini ${response?.status ?? 'unreachable'}`,
			)
		}
		await sleep(delay, signal)
	}
}

function requestBody(
	request: ModelRequest,
	extraConfig: Record<string, unknown> = {},
) {
	return {
		systemInstruction: { parts: [{ text: request.system }] },
		contents: request.turns.map((turn) => ({
			role: turn.role,
			parts: [{ text: turn.text }],
		})),
		generationConfig: {
			temperature: request.temperature ?? 0.2,
			maxOutputTokens: request.maxOutputTokens ?? 2048,
			...extraConfig,
		},
	}
}

function textOf(response: GeminiResponse) {
	return (
		response.candidates?.[0]?.content?.parts
			?.filter((part) => !part.thought)
			.map((part) => part.text ?? '')
			.join('') ?? ''
	)
}

function assertNotBlocked(reason: string | undefined) {
	if (reason && BLOCKED_REASONS.has(reason)) {
		throw new ModelError(
			'PROVIDER_BLOCKED',
			`Gemini blocked the response (${reason})`,
		)
	}
}

const usageOf = (response: GeminiResponse): Usage => ({
	inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
	outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
})

function normalize(values: number[]) {
	const length = Math.hypot(...values)
	return length ? values.map((value) => value / length) : values
}

export const gemini: ModelAdapter = {
	async *streamText(request, signal) {
		const response = await post(
			request.model,
			'streamGenerateContent?alt=sse',
			requestBody(request),
			signal,
		)
		let usage: Usage = { inputTokens: 0, outputTokens: 0 }
		let reason = 'STOP'
		for await (const data of readSse(response.body!)) {
			const chunk = responseSchema.parse(JSON.parse(data))
			assertNotBlocked(chunk.promptFeedback?.blockReason)
			const text = textOf(chunk)
			if (text) yield { type: 'text', text }
			reason = chunk.candidates?.[0]?.finishReason ?? reason
			if (chunk.usageMetadata) usage = usageOf(chunk)
		}
		yield { type: 'usage', usage }
		assertNotBlocked(reason)
		yield { type: 'finish', reason }
	},

	async generateJson(request, schema, signal) {
		const { $schema: _, ...jsonSchema } = z.toJSONSchema(schema)
		for (let attempt = 0; attempt < 2; attempt++) {
			const response = await post(
				request.model,
				'generateContent',
				requestBody(request, {
					responseMimeType: 'application/json',
					responseJsonSchema: jsonSchema,
				}),
				signal,
			)
			const body = responseSchema.parse(await response.json())
			assertNotBlocked(body.promptFeedback?.blockReason)
			assertNotBlocked(body.candidates?.[0]?.finishReason)
			let candidate: unknown
			try {
				candidate = JSON.parse(textOf(body))
			} catch {
				continue
			}
			const parsed = schema.safeParse(candidate)
			if (parsed.success) return { value: parsed.data, usage: usageOf(body) }
		}
		throw new ModelError('PROVIDER_UNAVAILABLE', 'Gemini returned invalid JSON')
	},

	async embedQuery(model, text, signal) {
		const response = await post(
			model,
			'embedContent',
			{
				model: `models/${model}`,
				content: { parts: [{ text }] },
				taskType: 'RETRIEVAL_QUERY',
				outputDimensionality: EMBEDDING_DIMENSIONS,
			},
			signal,
		)
		const { embedding } = embeddingSchema.parse(await response.json())
		if (embedding.values.length !== EMBEDDING_DIMENSIONS) {
			throw new ModelError(
				'PROVIDER_UNAVAILABLE',
				`Gemini returned ${embedding.values.length} dimensions`,
			)
		}
		return normalize(embedding.values)
	},
}
