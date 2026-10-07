import type { Route } from './+types/login'
import { login } from '~/api/auth/server'
import { redirectIfSignedIn, startSession } from '~/lib/actions/auth.server'
import { pageTitle } from '~/lib/seo'
import { LoginModule } from '~/modules'

export async function loader({ request }: Route.LoaderArgs) {
	await redirectIfSignedIn(request)
	return null
}

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	const email = String(form.get('email') ?? '')
	const password = String(form.get('password') ?? '')

	const result = await login({ email, password })
	if ('error' in result) {
		return {
			error: result.error,
			field: result.error.includes('email') ? 'email' : 'password',
		}
	}
	return startSession(request, result, form.get('return_to'))
}

export const meta: Route.MetaFunction = () => pageTitle('Sign in')

export default LoginModule
