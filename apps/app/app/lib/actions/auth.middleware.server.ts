import { redirect, type MiddlewareFunction } from 'react-router'
import { sessionContext } from './auth.context.server'
import { getPreferredWorkspace } from './workspace.server'
import { getSessionClaims } from '~/api/auth/server'
import { getSession } from '~/api/workspaces/server'
import { createSupabaseServerClient } from '~/lib/supabase.server'

/**
 * Guards every signed-in page: verifies the Supabase session, loads the
 * person's membership in the workspace they chose with Prisma and sends people without a workspace to
 * onboarding. Refreshed session cookies are copied onto whatever response
 * comes back, redirects included.
 */
export const authMiddleware: MiddlewareFunction<Response> = async (
	{ request, context },
	next,
) => {
	const { supabase, headers } = createSupabaseServerClient(request)
	const withSessionCookies = (response: Response) => {
		headers.forEach((value, key) =>
			key.toLowerCase() === 'set-cookie'
				? response.headers.append(key, value)
				: response.headers.set(key, value),
		)
		return response
	}

	const url = new URL(request.url)
	const claims = await getSessionClaims(supabase)
	if (!claims) {
		const returnTo = encodeURIComponent(`${url.pathname}${url.search}`)
		return withSessionCookies(redirect(`/login?return_to=${returnTo}`))
	}

	const session = await getSession(claims, await getPreferredWorkspace(request))
	if (!session) return withSessionCookies(redirect('/onboarding'))

	context.set(sessionContext, session)
	return withSessionCookies(await next())
}
