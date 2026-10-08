type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'

interface User {
	id: string
	name: string
	email: string
	role: MemberRole
	organization_id: string
	avatar_url: string | null
	/** Permission keys granted by the person's roles in this organization. */
	permissions: PermissionKey[]
}
