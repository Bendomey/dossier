import { redirect } from 'react-router'
import type { Route } from './+types/reset-password'
import { getSessionClaims, updatePassword } from '~/api/auth/server'
import { withHeaders } from '~/lib/actions/auth.server'
import { pageTitle } from '~/lib/seo'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { ResetPasswordModule } from '~/modules'

/** Reached through a recovery link, which signs the person in first. */
async function requireRecoverySession(request: Request) {
	const { supabase, headers } = createSupabaseServerClient(request)
	const claims = await getSessionClaims(supabase)
	if (!claims) throw redirect('/forgot-password?error=expired', { headers })
	return { supabase, headers, claims }
}

export async function loader({ request }: Route.LoaderArgs) {
	const { headers, claims } = await requireRecoverySession(request)
	const invited = new URL(request.url).searchParams.get('invited') === '1'
	return withHeaders({ email: claims.email ?? '', invited }, headers)
}

export async function action({ request }: Route.ActionArgs) {
	const { supabase, headers } = await requireRecoverySession(request)
	const password = String((await request.formData()).get('password') ?? '')

	const failure = await updatePassword(supabase, password)
	if (failure) return withHeaders(failure, headers, { status: 400 })
	return withHeaders({ updated: true as const }, headers)
}

export const meta: Route.MetaFunction = () => pageTitle('Choose a new password')

export default ResetPasswordModule
