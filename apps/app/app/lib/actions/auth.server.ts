import { data, redirect } from 'react-router'
import { getSessionClaims } from '~/api/auth/server'
import { createSupabaseServerClient } from '~/lib/supabase.server'

/** For the sign-in and sign-up pages: someone already signed in goes straight to the app. */
export async function redirectIfSignedIn(request: Request) {
	const { supabase, headers } = createSupabaseServerClient(request)
	if (await getSessionClaims(supabase)) throw redirect('/', { headers })
	return headers
}

/** Returns data with the session cookies Supabase set during this request. */
export function withHeaders<T>(
	value: T,
	headers: Headers,
	init?: ResponseInit,
) {
	return data(value, { ...init, headers })
}
