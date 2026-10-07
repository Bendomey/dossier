import { createContext, useContext, type PropsWithChildren } from 'react'

interface AppBase {
	/** Prefix for in-app links: '' for the signed-in app, '/demo' for the public demo. */
	base: string
	demo: boolean
}

const AppBaseContext = createContext<AppBase>({ base: '', demo: false })

export function AppBaseProvider({
	base,
	children,
}: PropsWithChildren<{ base: string }>) {
	return (
		<AppBaseContext.Provider value={{ base, demo: base === '/demo' }}>
			{children}
		</AppBaseContext.Provider>
	)
}

export function useAppBase() {
	const { base, demo } = useContext(AppBaseContext)
	return {
		demo,
		/** Resolves an app path such as '/knowledge' against the current base. */
		path: (to: string) => (to === '/' ? base || '/' : `${base}${to}`),
	}
}
