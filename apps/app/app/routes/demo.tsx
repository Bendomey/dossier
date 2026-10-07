import { Outlet } from 'react-router'
import { AppShell } from '~/components/layout/app-shell'
import { DEMO_USER } from '~/lib/mock/seed'
import { pageTitle } from '~/lib/seo'
import { AppBaseProvider } from '~/providers/app-base-provider'
import { AuthProvider } from '~/providers/auth-provider'

export const meta = () => pageTitle('Demo')

/** Public, auth-free copy of the app that the website embeds as its product demo. */
export default function DemoLayout() {
	return (
		<AppBaseProvider base="/demo">
			<AuthProvider user={DEMO_USER}>
				<AppShell>
					<Outlet />
				</AppShell>
			</AuthProvider>
		</AppBaseProvider>
	)
}
