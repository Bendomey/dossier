import { data, redirect } from 'react-router'
import type { Route } from './+types/_auth.settings.account'
import { updateProfileName } from '~/api/account/server'
import { requireSession } from '~/lib/actions/session.server'
import { pageTitle } from '~/lib/seo'
import { createSupabaseServerClient } from '~/lib/supabase.server'
import { AccountSettingsModule } from '~/modules'

export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	const form = await request.formData()

	if (form.get('intent') === 'sign-out-everywhere') {
		const { supabase, headers } = createSupabaseServerClient(request)
		await supabase.auth.signOut({ scope: 'global' })
		throw redirect('/login', { headers })
	}

	const name = String(form.get('name') ?? '').trim()
	if (!name || name.length > 120) {
		return data(
			{ ok: false, error: 'Enter a name up to 120 characters.' },
			{ status: 400 },
		)
	}
	await updateProfileName(session.user.id, name)
	return { ok: true, error: null }
}

export const meta = () => pageTitle('Your account')

export default AccountSettingsModule
