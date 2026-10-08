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
	expired: boolean
}

interface PeopleOverview {
	members: OrganizationPerson[]
	/** The membership to continue after; null on the last page. */
	next_cursor: string | null
	/** First page only, like invitations and groups. */
	total_members: number
	role_counts: Record<MemberRole, number>
	invitations: PendingInvitation[]
	groups: Array<{ id: string; name: string; is_system: boolean }>
}

/** Settings, Groups: every group with who is in it and which collections it can see. */
interface GroupsOverview {
	groups: Array<{
		id: string
		name: string
		is_system: boolean
		membership_ids: string[]
		collection_ids: string[]
	}>
	members: Array<{ membership_id: string; name: string; role: MemberRole }>
	collections: Array<{ id: string; name: string }>
	/** The group to continue after; null on the last page. */
	next_cursor: string | null
}
