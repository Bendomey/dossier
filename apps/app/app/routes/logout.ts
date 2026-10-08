import { redirect } from 'react-router'
import type { Route } from './+types/logout'
import { workspaceCookie } from '~/lib/actions/workspace.server'
import { createSupabaseServerClient } from '~/lib/supabase.server'

export async function action({ request }: Route.ActionArgs) {
	const { supabase, headers } = createSupabaseServerClient(request)
	await supabase.auth.signOut()
	headers.append(
		'Set-Cookie',
		await workspaceCookie.serialize('', { maxAge: 0 }),
	)
	throw redirect('/login', { headers })
}

export function loader() {
	return redirect('/')
}
