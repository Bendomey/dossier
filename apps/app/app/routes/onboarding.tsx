import { redirect } from 'react-router'
import type { Route } from './+types/onboarding'
import { getSessionClaims } from '~/api/auth/server'
import { joinInvitationsIfNew } from '~/api/members/server'
import {
	companyFromSignup,
	createWorkspace,
	getSession,
	type SessionIdentity,
} from '~/api/workspaces/server'
import { withHeaders } from '~/lib/actions/auth.server'
import { rememberWorkspace } from '~/lib/actions/workspace.server'
import { pageTitle } from '~/lib/seo'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { OnboardingModule } from '~/modules'

async function requireIdentity(request: Request) {
	const { supabase, headers } = createSupabaseServerClient(request)
	const claims = await getSessionClaims(supabase)
	if (!claims) throw redirect('/login?return_to=%2Fonboarding', { headers })
	return { claims, headers }
}

const wantsAnotherWorkspace = (request: Request) =>
	new URL(request.url).searchParams.get('new') === '1'

async function createAndOpen(
	identity: SessionIdentity,
	company: string,
	headers: Headers,
): Promise<never> {
	const organization = await createWorkspace(identity, company)
	headers.append('Set-Cookie', await rememberWorkspace(organization.id))
	throw redirect('/', { headers })
}

/**
 * Creates a workspace: the first one after sign-up (made on the spot from the
 * company given at sign-up, or asked for after Google sign-in), or another
 * one from the workspace switcher (`?new=1`).
 */
export async function loader({ request }: Route.LoaderArgs) {
	const { claims, headers } = await requireIdentity(request)
	const additional = wantsAnotherWorkspace(request)

	if (!additional) {
		if (await getSession(claims)) throw redirect('/', { headers })
		if (
			claims.email &&
			(await joinInvitationsIfNew(claims.sub, claims.email)).length
		) {
			throw redirect('/', { headers })
		}
		const company = companyFromSignup(claims)
		if (company) await createAndOpen(claims, company, headers)
	}

	return withHeaders({ email: claims.email ?? '', additional }, headers)
}

export async function action({ request }: Route.ActionArgs) {
	const { claims, headers } = await requireIdentity(request)
	if (!wantsAnotherWorkspace(request) && (await getSession(claims))) {
		throw redirect('/', { headers })
	}

	const company = String((await request.formData()).get('company') ?? '').trim()
	if (!company)
		return withHeaders({ error: 'Enter your company name.' }, headers, {
			status: 400,
		})

	return createAndOpen(claims, company, headers)
}

export const meta: Route.MetaFunction = () => pageTitle('Set up your workspace')

export default OnboardingModule
