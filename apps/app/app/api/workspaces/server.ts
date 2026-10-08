import { randomBytes } from 'node:crypto'
import { db } from '~/lib/db.server'

export interface SessionIdentity {
	sub: string
	email?: string
	user_metadata?: Record<string, unknown>
}

const ROLE_BY_SYSTEM_NAME: Record<string, MemberRole> = {
	Owner: 'OWNER',
	Admin: 'ADMIN',
	Member: 'MEMBER',
}

const displayName = (identity: SessionIdentity) => {
	const metadata = identity.user_metadata ?? {}
	const name = metadata.full_name ?? metadata.name
	return typeof name === 'string' && name.trim()
		? name.trim()
		: (identity.email?.split('@')[0] ?? 'New user')
}

/**
 * The Supabase trigger normally creates the profile at sign-up; this covers
 * accounts that predate it and keeps the profile row guaranteed.
 */
async function ensureProfile(identity: SessionIdentity) {
	const name = displayName(identity)
	return db().profile.upsert({
		where: { id: identity.sub },
		create: { id: identity.sub, displayName: name },
		update: {},
	})
}

/**
 * The signed-in person in their organization, or null when they do not
 * belong to one yet and need onboarding. The first active membership wins
 * until an organization switcher exists.
 */
export async function getCurrentUser(
	identity: SessionIdentity,
): Promise<User | null> {
	const membership = await db().organizationMember.findFirst({
		where: {
			userId: identity.sub,
			status: 'ACTIVE',
			organization: { status: 'ACTIVE' },
		},
		orderBy: { joinedAt: 'asc' },
		include: { user: true, roles: { include: { role: true } } },
	})
	if (!membership) return null

	const roles = membership.roles
		.map(({ role }) => ROLE_BY_SYSTEM_NAME[role.name])
		.filter(Boolean)
	const role: MemberRole = roles.includes('OWNER')
		? 'OWNER'
		: roles.includes('ADMIN')
			? 'ADMIN'
			: 'MEMBER'

	return {
		id: identity.sub,
		name: membership.user.displayName ?? displayName(identity),
		email: identity.email ?? '',
		role,
		organization_id: membership.organizationId,
	}
}

function slugify(name: string) {
	const base = name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40)
	return base || 'workspace'
}

/**
 * Creates an organization with the person as its owner: membership, Owner
 * role, the built-in Everyone group and the audit entry, in one transaction.
 */
export async function createWorkspace(
	identity: SessionIdentity,
	companyName: string,
) {
	await ensureProfile(identity)
	const name = companyName.trim()
	const ownerRole = await db().role.findFirstOrThrow({
		where: { organizationId: null, name: 'Owner' },
	})

	let slug = slugify(name)
	if (await db().organization.findUnique({ where: { slug } })) {
		slug = `${slug}-${randomBytes(3).toString('hex')}`
	}

	return db().$transaction(async (tx) => {
		const organization = await tx.organization.create({ data: { name, slug } })
		const membership = await tx.organizationMember.create({
			data: {
				organizationId: organization.id,
				userId: identity.sub,
				roles: { create: { roleId: ownerRole.id } },
			},
		})
		await tx.group.create({
			data: {
				organizationId: organization.id,
				name: 'Everyone',
				isSystem: true,
				createdById: identity.sub,
				members: { create: { membershipId: membership.id } },
			},
		})
		await tx.auditLog.create({
			data: {
				organizationId: organization.id,
				actorUserId: identity.sub,
				action: 'organization.created',
				resourceType: 'organization',
				resourceId: organization.id,
				metadata: { name },
			},
		})
		return organization
	})
}

/** The company name given at sign-up, if any, for creating the workspace without asking again. */
export function companyFromSignup(identity: SessionIdentity) {
	const company = identity.user_metadata?.company
	return typeof company === 'string' && company.trim() ? company.trim() : null
}
