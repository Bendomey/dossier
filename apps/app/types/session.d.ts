type PermissionKey =
	| 'organization.read'
	| 'organization.update'
	| 'members.read'
	| 'members.invite'
	| 'members.remove'
	| 'roles.manage'
	| 'groups.manage'
	| 'collections.manage'
	| 'documents.read'
	| 'documents.create'
	| 'documents.update'
	| 'documents.delete'
	| 'templates.manage'
	| 'documents.generate'
	| 'chat.create'
	| 'chat.read'
	| 'audit.read'

/** The organization the signed-in person is working in, as shown across the app. */
interface SessionOrganization {
	id: string
	name: string
	slug: string
	logo_url: string | null
	member_count: number
}

interface OrganizationSettings {
	id: string
	name: string
	country: 'GH' | 'LR'
	response_language: ResponseLanguage
	require_citations: boolean
	members_can_upload: boolean
	detect_document_language: boolean
}

type UpdateOrganizationSettingsInput = Partial<Omit<OrganizationSettings, 'id'>>

/** Another workspace the person belongs to, for the switcher. */
interface WorkspaceSummary {
	id: string
	name: string
	logo_url: string | null
	role: MemberRole
}

/** An invitation waiting for the signed-in person to accept or decline. */
interface InvitationSummary {
	id: string
	organization_name: string
	role: Exclude<MemberRole, 'OWNER'>
	invited_by: string | null
}

interface Session {
	user: User
	organization: SessionOrganization
	workspaces: WorkspaceSummary[]
	invitations: InvitationSummary[]
}
