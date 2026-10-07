import { createCookie } from 'react-router'

export type Theme = 'light' | 'dark' | 'system'

export const themeCookie = createCookie('theme', {
	path: '/',
	sameSite: 'lax',
	maxAge: 60 * 60 * 24 * 365,
})

export function isTheme(value: unknown): value is Theme {
	return value === 'light' || value === 'dark' || value === 'system'
}

export async function getTheme(request: Request): Promise<Theme> {
	const value: unknown = await themeCookie.parse(request.headers.get('Cookie'))
	return isTheme(value) ? value : 'system'
}
