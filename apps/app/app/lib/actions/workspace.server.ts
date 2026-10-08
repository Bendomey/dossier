import { createCookie } from 'react-router'

/**
 * The workspace the person last opened. Only a preference: every request
 * checks it against their active memberships before using it.
 */
export const workspaceCookie = createCookie('workspace', {
	path: '/',
	sameSite: 'lax',
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	maxAge: 60 * 60 * 24 * 365,
})

export async function getPreferredWorkspace(request: Request) {
	const value: unknown = await workspaceCookie.parse(
		request.headers.get('Cookie'),
	)
	return typeof value === 'string' ? value : null
}

export const rememberWorkspace = (organizationId: string) =>
	workspaceCookie.serialize(organizationId)
