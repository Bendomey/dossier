import type { Route } from './+types/_auth.api.chats.$chatId._index'
import { chatErrorResponse, requireId } from '~/api/chats/http.server'
import { getChat } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

export async function loader({ params, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.read')
	try {
		return Response.json(await getChat(session, requireId(params.chatId)))
	} catch (error) {
		return chatErrorResponse(error)
	}
}
