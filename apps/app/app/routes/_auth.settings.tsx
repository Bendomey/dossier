import { Outlet } from 'react-router'
import { pageTitle } from '~/lib/seo'
import { SettingsLayoutModule } from '~/modules'

export const handle = { title: 'Settings' }

export const meta = () => pageTitle('Settings')

export default function SettingsLayout() {
	return (
		<SettingsLayoutModule>
			<Outlet />
		</SettingsLayoutModule>
	)
}
