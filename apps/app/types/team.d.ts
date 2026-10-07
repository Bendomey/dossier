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
