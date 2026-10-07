import { createCookie } from 'react-router'
import { type Language, DEFAULT_LANGUAGE, isLanguage } from './languages'

export const languageCookie = createCookie('lang', {
	path: '/',
	sameSite: 'lax',
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 365,
})

export async function getLanguage(request: Request): Promise<Language> {
	const value: unknown = await languageCookie.parse(
		request.headers.get('Cookie'),
	)
	return isLanguage(value) ? value : DEFAULT_LANGUAGE
}
