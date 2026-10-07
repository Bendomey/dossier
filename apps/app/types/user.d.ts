type MemberRole = 'OWNER' | 'ADMIN' | 'MEMBER'

interface User {
	id: string
	name: string
	email: string
	role: MemberRole
	organization_id: string
}
