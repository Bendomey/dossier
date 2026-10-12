import { redirect } from 'react-router'
import type { Route } from './+types/_auth.api.documents.$documentId.versions.$versionId.download'
import { versionDownloadUrl } from '~/api/documents/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

/** Redirects to a five-minute presigned link for the original file. */
export async function loader({ params, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'documents.read')
	return redirect(
		await versionDownloadUrl(session, params.documentId, params.versionId),
	)
}
