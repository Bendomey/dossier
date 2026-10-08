import type { Route } from './+types/demo.settings.audit-log'
import { AUDIT_EVENTS } from '~/lib/mock/seed'
import { pageTitle } from '~/lib/seo'
import { AuditLogSettingsModule } from '~/modules'

const CLOCK_TIME = /^\d{1,2}:\d{2}$/

export function loader({ request }: Route.LoaderArgs): AuditLogPage {
	const category = new URL(request.url).searchParams
		.get('category')
		?.toUpperCase()
	return {
		entries: AUDIT_EVENTS.filter(
			(event) => !category || event.category === category,
		).map((event) => ({
			id: event.id,
			occurred_at: '',
			...(CLOCK_TIME.test(event.time_label)
				? { day_label: 'Today', time_label: event.time_label }
				: { day_label: event.time_label, time_label: '' }),
			actor: event.actor,
			action: event.action,
			target: event.target,
			category: event.category,
		})),
		next_cursor: null,
	}
}

export const meta = () => pageTitle('Audit log')

export default AuditLogSettingsModule
