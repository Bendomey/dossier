import { redirect } from 'react-router'
import type { Route } from './+types/login'
import { getSessionClaims, signInWithPassword } from '~/api/auth/server'
import { landingAfterSignIn } from '~/api/members/server'
import { redirectIfSignedIn, withHeaders } from '~/lib/actions/auth.server'
import { safeRedirect } from '~/lib/misc'
import { pageTitle } from '~/lib/seo'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { LoginModule } from '~/modules'

const LINK_ERRORS: Record<string, string> = {
	link: 'That sign-in link is invalid or has expired. Sign in, or request a new link.',
	oauth: 'Google sign-in didn’t complete. Try again, or use your email.',
}

export async function loader({ request }: Route.LoaderArgs) {
	const headers = await redirectIfSignedIn(request)
	const errorCode = new URL(request.url).searchParams.get('error')
	return withHeaders(
		{ linkError: errorCode ? (LINK_ERRORS[errorCode] ?? null) : null },
		headers,
	)
}

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const { supabase, headers } = createSupabaseServerClient(request)

	const failure = await signInWithPassword(supabase, {
		email: String(form.get('email') ?? '').trim(),
		password: String(form.get('password') ?? ''),
	})
	if (failure) return withHeaders(failure, headers, { status: 400 })

	const target = safeRedirect(form.get('return_to'))
	const claims = await getSessionClaims(supabase)
	const { path } = claims
		? await landingAfterSignIn(claims, target)
		: { path: target }

	throw redirect(path, { headers })
}

export const meta: Route.MetaFunction = () => pageTitle('Sign in')

export default LoginModule
