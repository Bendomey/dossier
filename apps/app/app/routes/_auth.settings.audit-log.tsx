import type { Route } from './+types/_auth.settings.audit-log'
import { isAuditCategory, listAuditEntries } from '~/api/audit-events/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { pageTitle } from '~/lib/seo'
import { AuditLogSettingsModule } from '~/modules'

export function loader({ request, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'audit.read')
	const params = new URL(request.url).searchParams
	const category = params.get('category')?.toUpperCase()
	return listAuditEntries(session.organization.id, {
		category: isAuditCategory(category) ? category : undefined,
	})
}

export const meta = () => pageTitle('Audit log')

export default AuditLogSettingsModule
