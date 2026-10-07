import { data, redirect } from 'react-router'
import type { Route } from './+types/signup'
import { signup } from '~/api/auth/server'
import { redirectIfSignedIn, startSession } from '~/lib/actions/auth.server'
import {
	getAuthSession,
	saveAuthSession,
} from '~/lib/actions/auth.session.server'
import { pageTitle } from '~/lib/seo'
import { resolveUtm } from '~/lib/utm.server'
import { SignupModule } from '~/modules'

/*
 * The website hands over the visitor's email as ?email=. It moves into a
 * one-time flash value and the URL is rewritten without it, so the address
 * never reaches analytics or browser history. UTM parameters stay in the URL.
 */
export async function loader({ request }: Route.LoaderArgs) {
	await redirectIfSignedIn(request)
	const session = await getAuthSession(request.headers.get('Cookie'))
	const url = new URL(request.url)
	const email = url.searchParams.get('email')

	if (email !== null) {
		if (/\S+@\S+\.\S+/.test(email))
			session.flash('prefillEmail', email.slice(0, 254))
		url.searchParams.delete('email')
		throw redirect(`${url.pathname}${url.search}`, {
			headers: { 'Set-Cookie': await saveAuthSession(session) },
		})
	}

	return data(
		{ email: session.get('prefillEmail') ?? '' },
		{ headers: { 'Set-Cookie': await saveAuthSession(session) } },
	)
}

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const input = {
		name: String(form.get('name') ?? ''),
		company: String(form.get('company') ?? ''),
		email: String(form.get('email') ?? ''),
		password: String(form.get('password') ?? ''),
		utm: (await resolveUtm(request)).utm as Record<string, string>,
	}

	const result = await signup(input)
	if ('error' in result) {
		const field = /name/i.test(result.error)
			? 'name'
			: /company/i.test(result.error)
				? 'company'
				: /email/i.test(result.error)
					? 'email'
					: 'password'
		return { error: result.error, field }
	}
	return startSession(request, result, '/')
}

export const meta: Route.MetaFunction = () => pageTitle('Create your workspace')

export default SignupModule
