import type { Route } from './+types/_auth.api.chats.$chatId.archive'
import { chatErrorResponse, requireId } from '~/api/chats/http.server'
import { archiveChat } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

export async function action({ params, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.create')
	try {
		await archiveChat(session, requireId(params.chatId))
		return Response.json({ ok: true })
	} catch (error) {
		return chatErrorResponse(error)
	}
}
