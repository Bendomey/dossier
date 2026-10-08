interface Group {
	id: string
	name: string
	/** The built-in Everyone group contains every member and cannot be edited. */
	is_builtin: boolean
}

interface Member {
	id: string
	name: string
	email: string
	role: MemberRole
	group_ids: string[]
	invited: boolean
}

interface InviteMemberInput {
	email: string
	role: Exclude<MemberRole, 'OWNER'>
	group_ids: string[]
}

/** A member as listed in Settings, People. */
interface OrganizationPerson {
	membership_id: string
	user_id: string
	name: string
	email: string
	avatar_url: string | null
	role: MemberRole
	group_ids: string[]
}

interface PendingInvitation {
	id: string
	email: string
	role: Exclude<MemberRole, 'OWNER'>
	group_ids: string[]
	expires_at: string
}

interface PeopleOverview {
	members: OrganizationPerson[]
	invitations: PendingInvitation[]
	groups: Array<{ id: string; name: string; is_system: boolean }>
}
