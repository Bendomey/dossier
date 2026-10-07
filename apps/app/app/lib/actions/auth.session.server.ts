import { createCookieSessionStorage } from 'react-router'
import { environmentVariables } from './env.server'
import { SESSION_COOKIE } from '~/lib/constants'

type SessionData = {
	authToken: string
	userId: string
}

type SessionFlashData = {
	error: string
	prefillEmail: string
}

const env = environmentVariables()

const {
	getSession: getAuthSession,
	commitSession: saveAuthSession,
	destroySession: deleteAuthSession,
} = createCookieSessionStorage<SessionData, SessionFlashData>({
	cookie: {
		name: SESSION_COOKIE,
		httpOnly: true,
		path: '/',
		sameSite: 'lax',
		secrets: [env.SESSION_SECRET],
		secure: env.NODE_ENV === 'production',
		maxAge: 60 * 60 * 24 * 30,
	},
})

export { getAuthSession, saveAuthSession, deleteAuthSession }
