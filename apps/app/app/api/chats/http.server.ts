import * as z from 'zod'
import { ChatRequestError } from './server'

export const modeSchema = z
	.enum(['ASK', 'REVIEW', 'COMPARE', 'DRAFT'])
	.nullable()

const idSchema = z.uuid()

export function requireId(value: string | null | undefined) {
	const parsed = idSchema.safeParse(value)
	if (!parsed.success) {
		throw new ChatRequestError('This chat isn’t available.', 404, 'NOT_FOUND')
	}
	return parsed.data
}

export function idempotencyKeyOf(request: Request) {
	const parsed = idSchema.safeParse(request.headers.get('idempotency-key'))
	return parsed.success ? parsed.data : null
}

export const badRequest = () =>
	Response.json({ error: 'Check your message and try again.' }, { status: 400 })

export function chatErrorResponse(error: unknown) {
	if (error instanceof ChatRequestError) {
		return Response.json(
			{ error: error.message, code: error.code },
			{ status: error.status },
		)
	}
	throw error
}
