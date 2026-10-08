import { redirect } from 'react-router'
import type { Route } from './+types/auth.google'
import { startOAuth } from '~/api/auth/server'
import { safeRedirect } from '~/lib/misc'
import {
	createSupabaseServerClient,
	getRequestOrigin,
} from '~/lib/supabase.server'

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const { supabase, headers } = createSupabaseServerClient(request)
	const next = encodeURIComponent(safeRedirect(form.get('return_to')))

	const result = await startOAuth(
		supabase,
		'google',
		`${getRequestOrigin(request)}/auth/callback?next=${next}`,
	)
	// The PKCE code verifier rides along in `headers`; the callback needs it.
	if ('error' in result) throw redirect('/login?error=oauth', { headers })
	throw redirect(result.url, { headers })
}

export function loader() {
	return redirect('/login')
}
