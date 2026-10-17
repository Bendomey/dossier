import * as z from 'zod'
import type { Route } from './+types/_auth.api.chats.$chatId.cancel'
import {
	badRequest,
	chatErrorResponse,
	requireId,
} from '~/api/chats/http.server'
import { cancelReply } from '~/api/chats/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { abortReply } from '~/lib/ai/replies.server'

const bodySchema = z.object({ message_id: z.uuid() })

export async function action({ request, params, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'chat.create')
	const parsed = bodySchema.safeParse(await request.json().catch(() => null))
	if (!parsed.success) return badRequest()
	try {
		const chatId = requireId(params.chatId)
		if (await cancelReply(session, chatId, parsed.data.message_id)) {
			abortReply(parsed.data.message_id)
		}
		return Response.json({ ok: true })
	} catch (error) {
		return chatErrorResponse(error)
	}
}
