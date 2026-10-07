import { redirect } from 'react-router'
import { getAuthSession, saveAuthSession } from './auth.session.server'
import { safeRedirect } from '~/lib/misc'

export async function startSession(
	request: Request,
	auth: { token: string; user_id: string },
	returnTo: FormDataEntryValue | string | null,
) {
	const session = await getAuthSession(request.headers.get('Cookie'))
	session.set('authToken', auth.token)
	session.set('userId', auth.user_id)
	return redirect(safeRedirect(returnTo), {
		headers: { 'Set-Cookie': await saveAuthSession(session) },
	})
}

export async function redirectIfSignedIn(request: Request) {
	const session = await getAuthSession(request.headers.get('Cookie'))
	if (session.has('authToken')) throw redirect('/')
}
