import { data, type ShouldRevalidateFunctionArgs } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/_auth.knowledge.$documentId'
import {
	getDocumentDetail,
	removeDocument,
	retryIndexing,
} from '~/api/documents/server'
import { MemberError } from '~/api/members/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { DocumentWorkspaceDrawerModule } from '~/modules'

export type DocumentActionResult = { ok: boolean; error?: string }

const actionSchema = z.discriminatedUnion('intent', [
	z.object({ intent: z.literal('retry'), version_id: z.uuid() }),
	z.object({ intent: z.literal('remove') }),
])

export function loader({ params, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'documents.read')
	return getDocumentDetail(session, params.documentId)
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'documents.read')
	const parsed = actionSchema.safeParse(
		Object.fromEntries(await request.formData()),
	)
	if (!parsed.success) {
		return data<DocumentActionResult>(
			{ ok: false, error: 'Try that again.' },
			{ status: 400 },
		)
	}
	try {
		if (parsed.data.intent === 'retry') {
			await retryIndexing(session, params.documentId, parsed.data.version_id)
		} else {
			requirePermission(session, 'documents.delete')
			await removeDocument(session, params.documentId)
		}
		return { ok: true }
	} catch (error) {
		if (error instanceof MemberError) {
			return data<DocumentActionResult>(
				{ ok: false, error: error.message },
				{ status: 400 },
			)
		}
		throw error
	}
}

export function shouldRevalidate({
	formData,
	defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
	return formData?.get('intent') === 'remove' ? false : defaultShouldRevalidate
}

export default DocumentWorkspaceDrawerModule
