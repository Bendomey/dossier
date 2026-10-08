import type { Route } from './+types/forgot-password'
import { requestPasswordReset } from '~/api/auth/server'
import { withHeaders } from '~/lib/actions/auth.server'
import { pageTitle } from '~/lib/seo'
import {
	createSupabaseServerClient,
	getRequestOrigin,
} from '~/lib/supabase.server'
import { ForgotPasswordModule } from '~/modules'

export function loader({ request }: Route.LoaderArgs) {
	return {
		expired: new URL(request.url).searchParams.get('error') === 'expired',
	}
}

export async function action({ request }: Route.ActionArgs) {
	const { supabase, headers } = createSupabaseServerClient(request)
	const email = String((await request.formData()).get('email') ?? '').trim()

	const failure = await requestPasswordReset(
		supabase,
		email,
		`${getRequestOrigin(request)}/auth/callback?next=/reset-password`,
	)
	if (failure) return withHeaders(failure, headers, { status: 400 })
	return withHeaders({ sent: email }, headers)
}

export const meta: Route.MetaFunction = () => pageTitle('Reset your password')

export default ForgotPasswordModule
