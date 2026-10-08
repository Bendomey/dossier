import { pageTitle } from '~/lib/seo'
import { AccountSettingsModule } from '~/modules'

/** The demo has no accounts: the name changes in the visitor's page only. */
export function action() {
	return { ok: true, error: null }
}

export const meta = () => pageTitle('Your account')

export default AccountSettingsModule
