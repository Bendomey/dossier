import { ORGANIZATION } from '~/lib/mock/seed'
import { pageTitle } from '~/lib/seo'
import { OrganizationSettingsModule } from '~/modules'

export function loader() {
	const settings: OrganizationSettings = {
		id: ORGANIZATION.id,
		name: ORGANIZATION.name,
		country: ORGANIZATION.country,
		response_language: ORGANIZATION.response_language,
		require_citations: ORGANIZATION.require_citations,
		members_can_upload: ORGANIZATION.members_can_upload,
		detect_document_language: ORGANIZATION.detect_document_language,
	}
	return { settings }
}

/** The demo has no database: changes stay in the visitor's page until they reload. */
export function action() {
	return { ok: true, error: null }
}

export const meta = () => pageTitle('Organization')

export default OrganizationSettingsModule
