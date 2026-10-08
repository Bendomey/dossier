import { db } from '~/lib/db.server'

const toSettings = (organization: {
	id: string
	name: string
	country: OrganizationSettings['country']
	responseLanguage: ResponseLanguage
	requireCitations: boolean
	membersCanUpload: boolean
	detectDocumentLanguage: boolean
}): OrganizationSettings => ({
	id: organization.id,
	name: organization.name,
	country: organization.country,
	response_language: organization.responseLanguage,
	require_citations: organization.requireCitations,
	members_can_upload: organization.membersCanUpload,
	detect_document_language: organization.detectDocumentLanguage,
})

export async function getOrganizationSettings(organizationId: string) {
	return toSettings(
		await db().organization.findUniqueOrThrow({
			where: { id: organizationId },
		}),
	)
}

/** Saves the changed settings and records who changed what in the audit log. */
export async function updateOrganizationSettings(
	organizationId: string,
	actorUserId: string,
	input: UpdateOrganizationSettingsInput,
) {
	return db().$transaction(async (tx) => {
		const before = toSettings(
			await tx.organization.findUniqueOrThrow({
				where: { id: organizationId },
			}),
		)
		const after = toSettings(
			await tx.organization.update({
				where: { id: organizationId },
				data: {
					name: input.name,
					country: input.country,
					responseLanguage: input.response_language,
					requireCitations: input.require_citations,
					membersCanUpload: input.members_can_upload,
					detectDocumentLanguage: input.detect_document_language,
				},
			}),
		)

		const changes = Object.fromEntries(
			(Object.keys(input) as Array<keyof UpdateOrganizationSettingsInput>)
				.filter((key) => before[key] !== after[key])
				.map((key) => [key, { from: before[key], to: after[key] }]),
		)
		if (Object.keys(changes).length) {
			await tx.auditLog.create({
				data: {
					organizationId,
					actorUserId,
					action: 'organization.updated',
					resourceType: 'organization',
					resourceId: organizationId,
					metadata: { changes },
				},
			})
		}
		return after
	})
}
