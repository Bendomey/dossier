import { data, redirect } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/workspaces'
import { getSessionClaims } from '~/api/auth/server'
import {
	MemberError,
	acceptInvitation,
	declineInvitation,
} from '~/api/members/server'
import { listInvitationsFor, listWorkspaces } from '~/api/workspaces/server'
import { withHeaders } from '~/lib/actions/auth.server'
import {
	getPreferredWorkspace,
	rememberWorkspace,
} from '~/lib/actions/workspace.server'
import { pageTitle } from '~/lib/seo'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { WorkspacesModule } from '~/modules'

const actionSchema = z.discriminatedUnion('intent', [
	z.object({ intent: z.literal('open'), organization_id: z.uuid() }),
	z.object({ intent: z.literal('accept'), invitation_id: z.uuid() }),
	z.object({ intent: z.literal('decline'), invitation_id: z.uuid() }),
])

async function requireIdentity(request: Request) {
	const { supabase, headers } = createSupabaseServerClient(request)
	const claims = await getSessionClaims(supabase)
	if (!claims) throw redirect('/login?return_to=%2Fworkspaces', { headers })
	return { claims, headers }
}

/** Every workspace the person belongs to, plus invitations waiting for them. */
export async function loader({ request }: Route.LoaderArgs) {
	const { claims, headers } = await requireIdentity(request)
	const [workspaces, invitations] = await Promise.all([
		listWorkspaces(claims.sub),
		listInvitationsFor(claims.email),
	])
	if (!workspaces.length && !invitations.length) {
		throw redirect('/onboarding', { headers })
	}
	const preferred = await getPreferredWorkspace(request)
	const currentId =
		workspaces.find((workspace) => workspace.id === preferred)?.id ??
		workspaces[0]?.id ??
		null

	return withHeaders(
		{ email: claims.email ?? '', workspaces, invitations, currentId },
		headers,
	)
}

export async function action({ request }: Route.ActionArgs) {
	const { claims, headers } = await requireIdentity(request)
	const parsed = actionSchema.safeParse(
		Object.fromEntries(await request.formData()),
	)
	if (!parsed.success) {
		return data(
			{ error: 'That request wasn’t valid.' },
			{ status: 400, headers },
		)
	}
	const input = parsed.data
	const open = async (organizationId: string): Promise<never> => {
		headers.append('Set-Cookie', await rememberWorkspace(organizationId))
		throw redirect('/', { headers })
	}

	try {
		switch (input.intent) {
			case 'open': {
				const workspaces = await listWorkspaces(claims.sub)
				if (!workspaces.some(({ id }) => id === input.organization_id)) {
					return data(
						{ error: 'You’re no longer a member of that workspace.' },
						{ status: 403, headers },
					)
				}
				return open(input.organization_id)
			}
			case 'accept':
				return open(
					await acceptInvitation(
						claims.sub,
						claims.email ?? '',
						input.invitation_id,
					),
				)
			case 'decline':
				await declineInvitation(
					claims.sub,
					claims.email ?? '',
					input.invitation_id,
				)
				return data({ error: null }, { headers })
		}
	} catch (error) {
		if (error instanceof MemberError) {
			return data({ error: error.message }, { status: 400, headers })
		}
		throw error
	}
}

export const meta: Route.MetaFunction = () => pageTitle('Your workspaces')

export default WorkspacesModule
