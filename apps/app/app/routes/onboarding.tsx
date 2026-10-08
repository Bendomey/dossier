import { redirect } from 'react-router'
import type { Route } from './+types/onboarding'
import { getSessionClaims } from '~/api/auth/server'
import {
	companyFromSignup,
	createWorkspace,
	getCurrentUser,
} from '~/api/workspaces/server'
import { withHeaders } from '~/lib/actions/auth.server'
import { pageTitle } from '~/lib/seo'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { OnboardingModule } from '~/modules'

async function requireIdentity(request: Request) {
	const { supabase, headers } = createSupabaseServerClient(request)
	const claims = await getSessionClaims(supabase)
	if (!claims) throw redirect('/login?return_to=%2Fonboarding', { headers })
	return { claims, headers }
}

/**
 * Signed in but without a workspace. People who gave a company at sign-up get
 * it created on the spot; Google sign-ups are asked for one.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const { claims, headers } = await requireIdentity(request)
	if (await getCurrentUser(claims)) throw redirect('/', { headers })

	const company = companyFromSignup(claims)
	if (company) {
		await createWorkspace(claims, company)
		throw redirect('/', { headers })
	}

	return withHeaders({ email: claims.email ?? '' }, headers)
}

export async function action({ request }: Route.ActionArgs) {
	const { claims, headers } = await requireIdentity(request)
	if (await getCurrentUser(claims)) throw redirect('/', { headers })

	const company = String((await request.formData()).get('company') ?? '').trim()
	if (!company)
		return withHeaders({ error: 'Enter your company name.' }, headers, {
			status: 400,
		})

	await createWorkspace(claims, company)
	throw redirect('/', { headers })
}

export const meta: Route.MetaFunction = () => pageTitle('Set up your workspace')

export default OnboardingModule
