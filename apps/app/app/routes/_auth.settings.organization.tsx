import { data } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/_auth.settings.organization'
import {
	getOrganizationSettings,
	updateOrganizationSettings,
} from '~/api/organization/server'
import { requirePermission, requireSession } from '~/lib/actions/session.server'
import { pageTitle } from '~/lib/seo'
import { OrganizationSettingsModule } from '~/modules'

const toggle = z.enum(['true', 'false']).transform((value) => value === 'true')

/** Every field is optional: each control saves on its own. */
const updateSchema = z
	.object({
		name: z.string().trim().min(1, 'Enter the organization name.').max(120),
		country: z.enum(['GH', 'LR']),
		response_language: z.enum(['MATCH', 'EN', 'FR', 'PT']),
		require_citations: toggle,
		members_can_upload: toggle,
		detect_document_language: toggle,
	})
	.partial()
	.strict()

export async function loader({ context }: Route.LoaderArgs) {
	const session = requireSession(context)
	return { settings: await getOrganizationSettings(session.organization.id) }
}

export async function action({ request, context }: Route.ActionArgs) {
	const session = requireSession(context)
	requirePermission(session, 'organization.update')

	const parsed = updateSchema.safeParse(
		Object.fromEntries(await request.formData()),
	)
	if (!parsed.success) {
		return data(
			{
				ok: false,
				error:
					parsed.error.issues[0]?.message ?? 'Check the value and try again.',
			},
			{ status: 400 },
		)
	}

	await updateOrganizationSettings(
		session.organization.id,
		session.user.id,
		parsed.data,
	)
	return { ok: true, error: null }
}

export const meta = () => pageTitle('Organization')

export default OrganizationSettingsModule
