import { redirect } from 'react-router'
import type { Route } from './+types/auth.callback'
import {
	completeAuthRedirect,
	getSessionClaims,
	signedInWithEmailLink,
} from '~/api/auth/server'
import { landingAfterSignIn } from '~/api/members/server'
import { safeRedirect } from '~/lib/misc'
import { createSupabaseServerClient } from '~/lib/supabase.server'

/** Lands Google sign-ins and email links (confirmation, magic link) and starts the session. */
export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const { supabase, headers } = createSupabaseServerClient(request)

	if (url.searchParams.has('error'))
		throw redirect('/login?error=oauth', { headers })

	const failure = await completeAuthRedirect(supabase, url.searchParams)
	if (failure) throw redirect('/login?error=link', { headers })

	const target = safeRedirect(url.searchParams.get('next'))
	const claims = await getSessionClaims(supabase)
	const { path, joined } = claims
		? await landingAfterSignIn(claims, target)
		: { path: target, joined: [] }

	// Invited people arrive through the emailed link with no password yet.
	if (
		joined.length &&
		claims &&
		signedInWithEmailLink(claims) &&
		url.searchParams.get('type') === 'invite'
	) {
		throw redirect('/reset-password?invited=1', { headers })
	}
	throw redirect(path, { headers })
}
