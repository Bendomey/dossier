import * as z from 'zod'
import type { Route } from './+types/_auth.api.chats.$chatId.messages'
import {
	badRequest,
	chatErrorResponse,
	idempotencyKeyOf,
	modeSchema,
	requireId,
} from '~/api/chats/http.server'
import { getChat, sendMessage } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { startReply } from '~/lib/ai/orchestrator.server'

const bodySchema = z.object({
	prompt: z.string().trim().min(1).max(8000),
	mode: modeSchema,
})

export async function action({ request, params, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.create')
	const parsed = bodySchema.safeParse(await request.json().catch(() => null))
	const idempotencyKey = idempotencyKeyOf(request)
	if (!parsed.success || !idempotencyKey) return badRequest()
	try {
		const chatId = requireId(params.chatId)
		const started = await sendMessage(session, chatId, {
			...parsed.data,
			idempotencyKey,
		})
		if (started.created) startReply(session, chatId, started.assistantMessageId)
		return Response.json(await getChat(session, chatId))
	} catch (error) {
		return chatErrorResponse(error)
	}
}
