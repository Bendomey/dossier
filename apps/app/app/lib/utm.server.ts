import { createCookie } from 'react-router'
import { readUtm, type Utm } from './utm'

const utmCookie = createCookie('utm', {
	path: '/',
	sameSite: 'lax',
	httpOnly: true,
	maxAge: 60 * 60 * 24 * 30,
})

/**
 * Returns the visitor's campaign parameters: the ones on this request if
 * present (and a cookie to remember them), otherwise the remembered ones.
 */
export async function resolveUtm(request: Request) {
	const fromUrl = readUtm(new URL(request.url).searchParams)
	if (Object.keys(fromUrl).length) {
		return { utm: fromUrl, setCookie: await utmCookie.serialize(fromUrl) }
	}
	const stored: unknown = await utmCookie.parse(request.headers.get('Cookie'))
	return {
		utm: (stored && typeof stored === 'object' ? stored : {}) as Utm,
		setCookie: null,
	}
}
