import type { Route } from './+types/_auth.api.people'
import { getPeopleOverview } from '~/api/members/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

/** A page of members as JSON, for scrolling past the first page in Settings, People. */
export async function loader({ request, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'members.read')
	return Response.json(
		await getPeopleOverview(session.organization.id, {
			before: new URL(request.url).searchParams.get('before'),
		}),
	)
}
