import { MEMBERS, ORGANIZATION } from '~/lib/mock/seed'

const DEMO_PASSWORD_MIN = 1
const SIGNUP_PASSWORD_MIN = 8

interface AuthResult {
	token: string
	user_id: string
}

const owner = MEMBERS.find((member) => member.role === 'OWNER')!

const toUser = (member: Member): User => ({
	id: member.id,
	name: member.name,
	email: member.email,
	role: member.role,
	organization_id: ORGANIZATION.id,
})

/**
 * Until the API exists any well-formed email signs in: a known address becomes
 * that member, anything else becomes the workspace owner.
 */
export async function login(input: {
	email: string
	password: string
}): Promise<AuthResult | { error: string }> {
	if (!/\S+@\S+\.\S+/.test(input.email))
		return { error: 'Enter a valid work email.' }
	if (input.password.length < DEMO_PASSWORD_MIN)
		return { error: 'Enter your password.' }

	const member =
		MEMBERS.find((item) => item.email === input.email.trim().toLowerCase()) ??
		owner
	return { token: `mock.${member.id}`, user_id: member.id }
}

export async function signup(input: {
	name: string
	company: string
	email: string
	password: string
	/** Campaign parameters the person arrived with, for attribution. */
	utm: Record<string, string>
}): Promise<AuthResult | { error: string }> {
	if (!input.name.trim()) return { error: 'Enter your name.' }
	if (!input.company.trim()) return { error: 'Enter your company name.' }
	if (!/\S+@\S+\.\S+/.test(input.email))
		return { error: 'Enter a valid work email.' }
	if (input.password.length < SIGNUP_PASSWORD_MIN)
		return { error: 'Use at least 8 characters.' }
	return { token: `mock.${owner.id}`, user_id: owner.id }
}

export async function loginWithGoogle(): Promise<AuthResult> {
	return { token: `mock.${owner.id}`, user_id: owner.id }
}

export async function getCurrentUser(token: string, userId?: string) {
	if (!token.startsWith('mock.')) return null
	const member = MEMBERS.find((item) => item.id === userId)
	return member ? toUser(member) : null
}
