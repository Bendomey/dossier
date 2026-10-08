import { Outlet } from 'react-router'
import type { Route } from './+types/_auth'
import { AppShell } from '~/components/layout/app-shell'
import { authMiddleware } from '~/lib/actions/auth.middleware.server'
import { requireSession } from '~/lib/actions/session.server'
import { SessionProvider } from '~/providers/session-provider'

export const middleware = [authMiddleware]

export function loader({ context }: Route.LoaderArgs) {
	return requireSession(context)
}

export default function AuthLayout({ loaderData }: Route.ComponentProps) {
	return (
		<SessionProvider session={loaderData}>
			<AppShell>
				<Outlet />
			</AppShell>
		</SessionProvider>
	)
}
