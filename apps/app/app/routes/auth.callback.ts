import { redirect } from 'react-router'
import type { Route } from './+types/auth.callback'
import { completeAuthRedirect } from '~/api/auth/server'
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

	throw redirect(safeRedirect(url.searchParams.get('next')), { headers })
}
