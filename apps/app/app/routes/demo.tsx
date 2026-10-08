import { Outlet } from 'react-router'
import type { Route } from './+types/demo'
import { AppShell } from '~/components/layout/app-shell'
import { DEMO_SESSION } from '~/lib/mock/seed'
import { pageTitle } from '~/lib/seo'
import { AppBaseProvider } from '~/providers/app-base-provider'
import { SessionProvider } from '~/providers/session-provider'

export const meta = () => pageTitle('Demo')

export function loader() {
	return DEMO_SESSION
}

/** Public, auth-free copy of the app that the website embeds as its product demo. */
export default function DemoLayout({ loaderData }: Route.ComponentProps) {
	return (
		<AppBaseProvider base="/demo">
			<SessionProvider session={loaderData}>
				<AppShell>
					<Outlet />
				</AppShell>
			</SessionProvider>
		</AppBaseProvider>
	)
}
