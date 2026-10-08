import { data, redirect } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/auth.session'
import { getSessionClaims, startSessionFromTokens } from '~/api/auth/server'
import { emailLinkDestination, landingAfterSignIn } from '~/api/members/server'
import {
	createSupabaseServerClient,
	getRequestOrigin,
} from '~/lib/supabase.server'

const schema = z.object({
	access_token: z.string().min(1),
	refresh_token: z.string().min(1),
	type: z.string().optional(),
})

/**
 * Receives the tokens /login reads from an email link's URL fragment and turns
 * them into a cookie session. Same-origin only, so another site can't sign a
 * visitor into an account of its choosing.
 */
export async function action({ request }: Route.ActionArgs) {
	if (request.headers.get('Origin') !== getRequestOrigin(request)) {
		return data({ error: 'forbidden' }, { status: 403 })
	}
	const parsed = schema.safeParse(Object.fromEntries(await request.formData()))
	if (!parsed.success) throw redirect('/login?error=link')

	const { supabase, headers } = createSupabaseServerClient(request)
	const failure = await startSessionFromTokens(supabase, {
		accessToken: parsed.data.access_token,
		refreshToken: parsed.data.refresh_token,
	})
	const claims = failure ? null : await getSessionClaims(supabase)
	if (!claims) throw redirect('/login?error=link', { headers })

	const landing = await landingAfterSignIn(claims, '/')
	throw redirect(emailLinkDestination(parsed.data.type ?? null, landing), {
		headers,
	})
}

export function loader() {
	return redirect('/login')
}
