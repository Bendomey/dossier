import { Outlet } from 'react-router'
import type { Route } from './+types/_auth'
import { AppShell } from '~/components/layout/app-shell'
import { userContext } from '~/lib/actions/auth.context.server'
import { authMiddleware } from '~/lib/actions/auth.middleware.server'
import { AuthProvider } from '~/providers/auth-provider'

export const middleware = [authMiddleware]

export function loader({ context }: Route.LoaderArgs) {
	const auth = context.get(userContext)
	if (!auth) throw new Response(null, { status: 401 })
	return { user: auth.user }
}

export default function AuthLayout({ loaderData }: Route.ComponentProps) {
	return (
		<AuthProvider user={loaderData.user}>
			<AppShell>
				<Outlet />
			</AppShell>
		</AuthProvider>
	)
}
