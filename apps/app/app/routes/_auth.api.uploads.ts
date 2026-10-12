import * as z from 'zod'
import type { Route } from './+types/_auth.api.uploads'
import { completeUpload, initiateUpload } from '~/api/uploads/server'
import { UploadError } from '~/api/uploads/validation'
import { requireSession } from '~/lib/actions/session.server'

const bodySchema = z.discriminatedUnion('intent', [
	z.object({
		intent: z.literal('initiate'),
		collection_id: z.uuid().optional(),
		document_id: z.uuid().optional(),
		file_name: z.string().min(1).max(1000),
		size: z.number().int().nonnegative(),
		content_type: z.string().max(200),
	}),
	z.object({
		intent: z.literal('complete'),
		token: z.string().min(1).max(4000),
	}),
])

/** Direct-to-R2 uploads: presign a staging PUT, then verify it and create the records. */
export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	const parsed = bodySchema.safeParse(await request.json().catch(() => null))
	if (!parsed.success) {
		return Response.json(
			{ error: 'Check the file and try again.' },
			{ status: 400 },
		)
	}
	const body = parsed.data
	try {
		if (body.intent === 'initiate') {
			return Response.json(
				await initiateUpload(session, {
					collectionId: body.collection_id,
					documentId: body.document_id,
					fileName: body.file_name,
					size: body.size,
					contentType: body.content_type,
				}),
			)
		}
		const { document_id } = await completeUpload(session, body.token)
		return Response.json({ document_id })
	} catch (error) {
		if (error instanceof UploadError) {
			return Response.json({ error: error.message }, { status: 400 })
		}
		throw error
	}
}
