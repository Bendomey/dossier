import type { Route } from './+types/_auth.api.chats.$chatId.stream'
import { chatErrorResponse, requireId } from '~/api/chats/http.server'
import { getReply } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { ensureStallSweep, followReply } from '~/lib/ai/replies.server'
import { eventStream } from '~/lib/ai/sse.server'

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.read')
	ensureStallSweep()
	try {
		const chatId = requireId(params.chatId)
		const messageId = requireId(
			new URL(request.url).searchParams.get('message'),
		)
		await getReply(session, chatId, messageId)
		return eventStream(request.signal, (send) =>
			followReply(session, chatId, messageId, send, request.signal),
		)
	} catch (error) {
		return chatErrorResponse(error)
	}
}
