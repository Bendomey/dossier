import { createCookieSessionStorage } from 'react-router'
import { environmentVariables } from './env.server'

type FlashData = {
	/** Email handed over by the website's sign-up form, shown once in the sign-up field. */
	prefillEmail: string
}

const env = environmentVariables()

const { getSession: getFlashSession, commitSession: saveFlashSession } =
	createCookieSessionStorage<Record<string, never>, FlashData>({
		cookie: {
			name: 'dossier-flash',
			httpOnly: true,
			path: '/',
			sameSite: 'lax',
			secrets: [env.SESSION_SECRET],
			secure: env.NODE_ENV === 'production',
		},
	})

export { getFlashSession, saveFlashSession }
