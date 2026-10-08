import { redirect } from 'react-router'
import type { Route } from './+types/signup'
import { signUp } from '~/api/auth/server'
import { redirectIfSignedIn, withHeaders } from '~/lib/actions/auth.server'
import { getFlashSession, saveFlashSession } from '~/lib/actions/flash.server'
import { pageTitle } from '~/lib/seo'
import {
	createSupabaseServerClient,
	getRequestOrigin,
} from '~/lib/supabase.server'
import { resolveUtm } from '~/lib/utm.server'
import { SignupModule } from '~/modules'

/*
 * The website hands over the visitor's email as ?email=. It moves into a
 * one-time flash value and the URL is rewritten without it, so the address
 * never reaches analytics or browser history. UTM parameters stay in the URL.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const headers = await redirectIfSignedIn(request)
	const flash = await getFlashSession(request.headers.get('Cookie'))
	const url = new URL(request.url)
	const email = url.searchParams.get('email')

	if (email !== null) {
		if (/\S+@\S+\.\S+/.test(email))
			flash.flash('prefillEmail', email.slice(0, 254))
		url.searchParams.delete('email')
		headers.append('Set-Cookie', await saveFlashSession(flash))
		throw redirect(`${url.pathname}${url.search}`, { headers })
	}

	const prefillEmail = flash.get('prefillEmail') ?? ''
	headers.append('Set-Cookie', await saveFlashSession(flash))
	return withHeaders({ email: prefillEmail }, headers)
}

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const { supabase, headers } = createSupabaseServerClient(request)
	const email = String(form.get('email') ?? '').trim()

	const result = await signUp(supabase, {
		name: String(form.get('name') ?? ''),
		company: String(form.get('company') ?? ''),
		email,
		password: String(form.get('password') ?? ''),
		utm: (await resolveUtm(request)).utm as Record<string, string>,
		emailRedirectTo: `${getRequestOrigin(request)}/auth/callback?next=/onboarding`,
	})

	if ('error' in result) return withHeaders(result, headers, { status: 400 })
	if (result.hasSession) throw redirect('/onboarding', { headers })
	return withHeaders({ checkEmail: email }, headers)
}

export const meta: Route.MetaFunction = () => pageTitle('Create your workspace')

export default SignupModule
