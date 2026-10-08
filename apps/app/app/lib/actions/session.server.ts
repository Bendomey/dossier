import { type RouterContextProvider } from 'react-router'
import { sessionContext } from './auth.context.server'

/** The session authMiddleware verified for this request. Only call it under `_auth` routes. */
export function requireSession(context: Readonly<RouterContextProvider>) {
	const session = context.get(sessionContext)
	if (!session) throw new Response(null, { status: 401 })
	return session
}

/** Throws 403 unless the signed-in person's roles grant the permission. */
export function requirePermission(session: Session, permission: PermissionKey) {
	if (!session.user.permissions.includes(permission)) {
		throw new Response('You don’t have permission to do this.', { status: 403 })
	}
}
