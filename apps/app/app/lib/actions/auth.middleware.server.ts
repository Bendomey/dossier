import { redirect, type MiddlewareFunction } from 'react-router'
import { userContext } from './auth.context.server'
import { deleteAuthSession, getAuthSession } from './auth.session.server'
import { getCurrentUser } from '~/api/auth/server'

export const authMiddleware: MiddlewareFunction<Response> = async (
	{ request, context },
	next,
) => {
	const session = await getAuthSession(request.headers.get('Cookie'))
	const url = new URL(request.url)
	const loginUrl = `/login?return_to=${encodeURIComponent(`${url.pathname}${url.search}`)}`

	const authToken = session.get('authToken')
	if (!authToken) {
		return redirect(loginUrl)
	}

	const user = await getCurrentUser(authToken, session.get('userId'))
	if (!user) {
		return redirect(loginUrl, {
			headers: { 'Set-Cookie': await deleteAuthSession(session) },
		})
	}

	context.set(userContext, { user })
	return next()
}
