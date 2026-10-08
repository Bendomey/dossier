import { createContext, useContext, type PropsWithChildren } from 'react'

interface SessionValue extends Session {
	/** Whether the signed-in person's roles grant the permission. */
	can: (permission: PermissionKey) => boolean
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({
	session,
	children,
}: PropsWithChildren<{ session: Session }>) {
	const can = (permission: PermissionKey) =>
		session.user.permissions.includes(permission)
	return (
		<SessionContext.Provider value={{ ...session, can }}>
			{children}
		</SessionContext.Provider>
	)
}

export function useSession() {
	const context = useContext(SessionContext)
	if (!context) {
		throw new Error('useSession must be used within a SessionProvider')
	}
	return context
}
