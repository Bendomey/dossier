import type { Route } from './+types/_auth.settings.audit-log[.]csv'
import { exportAuditCsv, isAuditCategory } from '~/api/audit-events/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

export async function loader({ request, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'audit.read')
	const category = new URL(request.url).searchParams
		.get('category')
		?.toUpperCase()
	const csv = await exportAuditCsv(
		session.organization.id,
		isAuditCategory(category) ? category : undefined,
	)
	const day = new Date().toISOString().slice(0, 10)
	return new Response(csv, {
		headers: {
			'Content-Type': 'text/csv; charset=utf-8',
			'Content-Disposition': `attachment; filename="dossier-audit-log-${day}.csv"`,
			'Cache-Control': 'no-store',
		},
	})
}
