import type { Route } from './+types/_auth.api.audit-log'
import { isAuditCategory, listAuditEntries } from '~/api/audit-events/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

/** A page of audit entries as JSON, for scrolling past the first page in Settings, Audit log. */
export async function loader({ request, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'audit.read')
	const params = new URL(request.url).searchParams
	const category = params.get('category')?.toUpperCase()
	return Response.json(
		await listAuditEntries(session.organization.id, {
			category: isAuditCategory(category) ? category : undefined,
			before: params.get('before'),
		}),
	)
}
