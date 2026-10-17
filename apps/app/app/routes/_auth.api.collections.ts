import type { Route } from './+types/_auth.api.collections'
import { listChatCollections } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

export async function loader({ context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.create')
	return Response.json(await listChatCollections(session))
}
