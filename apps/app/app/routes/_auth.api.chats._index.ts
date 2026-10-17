import * as z from 'zod'
import type { Route } from './+types/_auth.api.chats._index'
import {
	badRequest,
	chatErrorResponse,
	idempotencyKeyOf,
	modeSchema,
} from '~/api/chats/http.server'
import { createChat, getChat, listChats } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { startReply } from '~/lib/ai/orchestrator.server'

const bodySchema = z.object({
	prompt: z.string().trim().min(1).max(8000),
	mode: modeSchema,
	collection_id: z.uuid().nullable().optional(),
})

export async function loader({ context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.read')
	return Response.json(await listChats(session))
}

export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.create')
	const parsed = bodySchema.safeParse(await request.json().catch(() => null))
	const idempotencyKey = idempotencyKeyOf(request)
	if (!parsed.success || !idempotencyKey) return badRequest()
	try {
		const started = await createChat(session, {
			prompt: parsed.data.prompt,
			mode: parsed.data.mode,
			collectionId: parsed.data.collection_id ?? null,
			idempotencyKey,
		})
		if (started.created) {
			startReply(session, started.chatId, started.assistantMessageId)
		}
		return Response.json(await getChat(session, started.chatId))
	} catch (error) {
		return chatErrorResponse(error)
	}
}
