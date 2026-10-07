import type { Route } from './+types/auth.google'
import { loginWithGoogle } from '~/api/auth/server'
import { startSession } from '~/lib/actions/auth.server'

export async function action({ request }: Route.ActionArgs) {
	const form = await request.formData()
	return startSession(request, await loginWithGoogle(), form.get('return_to'))
}
