import {
	createServerClient,
	parseCookieHeader,
	serializeCookieHeader,
} from '@supabase/ssr'
import { environmentVariables } from './actions/env.server'

/**
 * A Supabase client bound to one request. Session cookies it refreshes or
 * clears are collected in `headers`; every response built from this request
 * must include them, or the browser keeps a stale session.
 */
export function createSupabaseServerClient(request: Request) {
	const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = environmentVariables()
	if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
		throw new Error(
			'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not set. Add them to the environment (see .env.example).',
		)
	}

	const headers = new Headers()
	const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll() {
				return parseCookieHeader(request.headers.get('Cookie') ?? '').map(
					({ name, value }) => ({ name, value: value ?? '' }),
				)
			},
			setAll(cookiesToSet, cacheHeaders) {
				cookiesToSet.forEach(({ name, value, options }) =>
					headers.append(
						'Set-Cookie',
						serializeCookieHeader(name, value, options),
					),
				)
				Object.entries(cacheHeaders).forEach(([key, value]) =>
					headers.set(key, value),
				)
			},
		},
	})

	return { supabase, headers }
}

/** The public origin, honouring Fly's proxy (requests reach the app over plain HTTP). */
export function getRequestOrigin(request: Request) {
	const url = new URL(request.url)
	const protocol =
		request.headers.get('X-Forwarded-Proto') ?? url.protocol.replace(':', '')
	const host = request.headers.get('X-Forwarded-Host') ?? url.host
	return `${protocol}://${host}`
}
