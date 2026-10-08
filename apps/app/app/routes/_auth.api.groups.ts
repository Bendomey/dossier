import type { Route } from './+types/_auth.api.groups'
import { getGroupsOverview } from '~/api/groups/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'

/** A page of groups as JSON, for scrolling past the first page in Settings, Groups. */
export async function loader({ request, context }: Route.LoaderArgs) {
	const session = requireSession(context)
	requirePermission(session, 'members.read')
	return Response.json(
		await getGroupsOverview(session.organization.id, {
			before: new URL(request.url).searchParams.get('before'),
		}),
	)
}
