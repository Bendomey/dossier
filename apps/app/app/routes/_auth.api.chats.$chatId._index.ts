import * as z from 'zod'
import type { Route } from './+types/_auth.api.chats.$chatId._index'
import {
	badRequest,
	chatErrorResponse,
	requireId,
} from '~/api/chats/http.server'
import { CHAT_TITLE_MAX, getChat, renameChat } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

const renameSchema = z.object({
	title: z.string().trim().min(1).max(CHAT_TITLE_MAX),
})

export async function loader({ params, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.read')
	try {
		return Response.json(await getChat(session, requireId(params.chatId)))
	} catch (error) {
		return chatErrorResponse(error)
	}
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.create')
	if (request.method !== 'PATCH') {
		return Response.json({ error: 'Method not allowed' }, { status: 405 })
	}
	const parsed = renameSchema.safeParse(await request.json().catch(() => null))
	if (!parsed.success) return badRequest()
	try {
		await renameChat(session, requireId(params.chatId), parsed.data.title)
		return Response.json({ ok: true })
	} catch (error) {
		return chatErrorResponse(error)
	}
}
