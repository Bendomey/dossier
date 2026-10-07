import { createContext, useContext, type PropsWithChildren } from 'react'

const AuthContext = createContext<{ currentUser: User } | null>(null)

export function AuthProvider({
	user,
	children,
}: PropsWithChildren<{ user: User }>) {
	return (
		<AuthContext.Provider value={{ currentUser: user }}>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}
