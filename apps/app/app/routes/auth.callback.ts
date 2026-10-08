import { redirect } from 'react-router'
import type { Route } from './+types/auth.callback'
import { completeAuthRedirect, getSessionClaims } from '~/api/auth/server'
import { emailLinkDestination, landingAfterSignIn } from '~/api/members/server'
import { safeRedirect } from '~/lib/misc'
import { createSupabaseServerClient } from '~/lib/supabase.server'

/**
 * Lands Google sign-ins and email links that use a code or token hash. Links
 * that carry the session in the URL fragment never reach the server here: they
 * end up on /login, which hands the tokens to /auth/session.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const { supabase, headers } = createSupabaseServerClient(request)

	if (url.searchParams.has('error'))
		throw redirect('/login?error=oauth', { headers })

	const failure = await completeAuthRedirect(supabase, url.searchParams)
	if (failure) throw redirect('/login?error=link', { headers })

	const target = safeRedirect(url.searchParams.get('next'))
	const claims = await getSessionClaims(supabase)
	const landing = claims
		? await landingAfterSignIn(claims, target)
		: { path: target, joined: [] }

	throw redirect(emailLinkDestination(url.searchParams.get('type'), landing), {
		headers,
	})
}
