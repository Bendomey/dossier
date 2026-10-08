import { createHash, randomBytes } from 'node:crypto'
import { ensureProfile } from '~/api/workspaces/server'
import type { Prisma } from '~/generated/prisma/client'
import { db } from '~/lib/db.server'

const INVITATION_TTL_DAYS = 7
const ASSIGNABLE_ROLES = { ADMIN: 'Admin', MEMBER: 'Member' } as const
const ROLE_BY_NAME: Record<string, MemberRole> = {
	Owner: 'OWNER',
	Admin: 'ADMIN',
	Member: 'MEMBER',
}

export class MemberError extends Error {}

const highestRole = (names: string[]): MemberRole => {
	const roles = names.map((name) => ROLE_BY_NAME[name]).filter(Boolean)
	return roles.includes('OWNER')
		? 'OWNER'
		: roles.includes('ADMIN')
			? 'ADMIN'
			: 'MEMBER'
}

async function systemRoleId(
	tx: Prisma.TransactionClient,
	role: keyof typeof ASSIGNABLE_ROLES | 'OWNER',
) {
	const name = role === 'OWNER' ? 'Owner' : ASSIGNABLE_ROLES[role]
	const found = await tx.role.findFirstOrThrow({
		where: { organizationId: null, name },
	})
	return found.id
}

/** Keeps group changes to the organization's own, editable groups. */
async function editableGroupIds(
	tx: Prisma.TransactionClient,
	organizationId: string,
	groupIds: string[],
) {
	if (!groupIds.length) return []
	const groups = await tx.group.findMany({
		where: { organizationId, id: { in: groupIds }, isSystem: false },
		select: { id: true },
	})
	if (groups.length !== new Set(groupIds).size)
		throw new MemberError(
			'Choose groups from this workspace. Everyone is assigned automatically.',
		)
	return groups.map((group) => group.id)
}

export async function getPeopleOverview(
	organizationId: string,
): Promise<PeopleOverview> {
	const [members, invitations, groups] = await Promise.all([
		db().organizationMember.findMany({
			where: { organizationId, status: 'ACTIVE' },
			orderBy: { joinedAt: 'asc' },
			include: {
				user: true,
				roles: { include: { role: true } },
				groups: {
					where: { group: { isSystem: false } },
					select: { groupId: true },
				},
			},
		}),
		db().organizationInvitation.findMany({
			where: { organizationId, status: 'PENDING' },
			orderBy: { createdAt: 'asc' },
			include: { role: true, groups: { select: { groupId: true } } },
		}),
		db().group.findMany({
			where: { organizationId },
			orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
			select: { id: true, name: true, isSystem: true },
		}),
	])

	return {
		members: members.map((member) => ({
			membership_id: member.id,
			user_id: member.userId,
			name: member.user.displayName ?? member.user.email ?? 'Unnamed',
			email: member.user.email ?? '',
			avatar_url: member.user.avatarUrl,
			role: highestRole(member.roles.map(({ role }) => role.name)),
			group_ids: member.groups.map(({ groupId }) => groupId),
		})),
		invitations: invitations.map((invitation) => ({
			id: invitation.id,
			email: invitation.email,
			role: invitation.role?.name === 'Admin' ? 'ADMIN' : 'MEMBER',
			group_ids: invitation.groups.map(({ groupId }) => groupId),
			expires_at: invitation.expiresAt.toISOString(),
			expired: invitation.expiresAt <= new Date(),
		})),
		groups: groups.map((group) => ({
			id: group.id,
			name: group.name,
			is_system: group.isSystem,
		})),
	}
}

/** Saves a pending invitation. Sending the email is the caller's job. */
export async function createInvitation(
	organizationId: string,
	actorUserId: string,
	input: {
		email: string
		role: keyof typeof ASSIGNABLE_ROLES
		groupIds: string[]
	},
) {
	const email = input.email.trim().toLowerCase()

	return db().$transaction(async (tx) => {
		const existingMember = await tx.organizationMember.findFirst({
			where: { organizationId, status: 'ACTIVE', user: { email } },
		})
		if (existingMember)
			throw new MemberError(`${email} is already in this workspace.`)

		const pending = await tx.organizationInvitation.findFirst({
			where: {
				organizationId,
				email,
				status: 'PENDING',
				expiresAt: { gt: new Date() },
			},
		})
		if (pending)
			throw new MemberError(`${email} already has a pending invitation.`)

		await tx.organizationInvitation.updateMany({
			where: {
				organizationId,
				email,
				status: 'PENDING',
				expiresAt: { lte: new Date() },
			},
			data: { status: 'EXPIRED' },
		})
		const groupIds =
			input.role === 'MEMBER'
				? await editableGroupIds(tx, organizationId, input.groupIds)
				: []
		const invitation = await tx.organizationInvitation.create({
			data: {
				organizationId,
				email,
				invitedById: actorUserId,
				roleId: await systemRoleId(tx, input.role),
				tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
				expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
				groups: { create: groupIds.map((groupId) => ({ groupId })) },
			},
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'member.invited',
				resourceType: 'invitation',
				resourceId: invitation.id,
				metadata: { email, role: input.role, group_ids: groupIds },
			},
		})
		return invitation
	})
}

/** Gives a pending invitation another week and returns the address to email again. */
export async function renewInvitation(
	organizationId: string,
	actorUserId: string,
	invitationId: string,
) {
	return db().$transaction(async (tx) => {
		const invitation = await tx.organizationInvitation.findFirst({
			where: { id: invitationId, organizationId, status: 'PENDING' },
		})
		if (!invitation) {
			throw new MemberError('That invitation was already used or revoked.')
		}
		await tx.organizationInvitation.update({
			where: { id: invitation.id },
			data: {
				expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000),
			},
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'member.invitation_resent',
				resourceType: 'invitation',
				resourceId: invitation.id,
				metadata: { email: invitation.email },
			},
		})
		return invitation.email
	})
}

export async function revokeInvitation(
	organizationId: string,
	actorUserId: string,
	invitationId: string,
) {
	await db().$transaction(async (tx) => {
		const invitation = await tx.organizationInvitation.findFirst({
			where: { id: invitationId, organizationId, status: 'PENDING' },
		})
		if (!invitation) {
			throw new MemberError('That invitation was already used or revoked.')
		}
		await tx.organizationInvitation.update({
			where: { id: invitation.id },
			data: { status: 'REVOKED' },
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'member.invitation_revoked',
				resourceType: 'invitation',
				resourceId: invitation.id,
				metadata: { email: invitation.email },
			},
		})
	})
}

async function findMembership(
	tx: Prisma.TransactionClient,
	organizationId: string,
	membershipId: string,
) {
	const membership = await tx.organizationMember.findFirst({
		where: { id: membershipId, organizationId, status: 'ACTIVE' },
		include: { roles: { include: { role: true } }, user: true },
	})
	if (!membership)
		throw new MemberError('That person is no longer in this workspace.')
	return membership
}

/** Sets someone to Admin or Member. The owner's role is fixed. */
export async function changeMemberRole(
	organizationId: string,
	actorUserId: string,
	membershipId: string,
	role: keyof typeof ASSIGNABLE_ROLES,
) {
	await db().$transaction(async (tx) => {
		const membership = await findMembership(tx, organizationId, membershipId)
		const current = highestRole(membership.roles.map(({ role: r }) => r.name))
		if (current === 'OWNER')
			throw new MemberError('The owner’s role can’t be changed.')
		if (current === role) return

		const systemRoleIds = membership.roles
			.filter(({ role: r }) => r.isSystem)
			.map(({ roleId }) => roleId)
		await tx.memberRole.deleteMany({
			where: { membershipId, roleId: { in: systemRoleIds } },
		})
		await tx.memberRole.create({
			data: {
				organizationId,
				membershipId,
				roleId: await systemRoleId(tx, role),
			},
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'role.assigned',
				resourceType: 'membership',
				resourceId: membershipId,
				metadata: {
					person: membership.user.displayName,
					from: current,
					to: role,
				},
			},
		})
	})
}

/** Replaces the editable groups a member belongs to. Everyone stays automatic. */
export async function setMemberGroups(
	organizationId: string,
	actorUserId: string,
	membershipId: string,
	groupIds: string[],
) {
	await db().$transaction(async (tx) => {
		const membership = await findMembership(tx, organizationId, membershipId)
		const nextGroupIds = await editableGroupIds(tx, organizationId, groupIds)

		await tx.groupMember.deleteMany({
			where: {
				membershipId,
				group: { organizationId, isSystem: false },
				groupId: { notIn: nextGroupIds },
			},
		})
		await tx.groupMember.createMany({
			data: nextGroupIds.map((groupId) => ({
				organizationId,
				groupId,
				membershipId,
			})),
			skipDuplicates: true,
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'member.groups_changed',
				resourceType: 'membership',
				resourceId: membershipId,
				metadata: {
					person: membership.user.displayName,
					group_ids: nextGroupIds,
				},
			},
		})
	})
}

type PendingInvitationRecord = Prisma.OrganizationInvitationGetPayload<{
	include: { groups: true }
}>

/** Membership, role, invited groups and Everyone; then marks the invitation accepted. */
async function joinFromInvitation(
	tx: Prisma.TransactionClient,
	invitation: PendingInvitationRecord,
	userId: string,
) {
	const { organizationId } = invitation
	const already = await tx.organizationMember.findUnique({
		where: { organizationId_userId: { organizationId, userId } },
	})
	if (!already) {
		const everyone = await tx.group.findFirst({
			where: { organizationId, isSystem: true },
		})
		const membership = await tx.organizationMember.create({
			data: {
				organizationId,
				userId,
				roles: {
					create: {
						roleId: invitation.roleId ?? (await systemRoleId(tx, 'MEMBER')),
					},
				},
			},
		})
		const groupIds = [
			...invitation.groups.map(({ groupId }) => groupId),
			...(everyone ? [everyone.id] : []),
		]
		await tx.groupMember.createMany({
			data: groupIds.map((groupId) => ({
				organizationId,
				groupId,
				membershipId: membership.id,
			})),
			skipDuplicates: true,
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId: userId,
				action: 'member.joined',
				resourceType: 'membership',
				resourceId: membership.id,
				metadata: { email: invitation.email, invitation_id: invitation.id },
			},
		})
	}
	await tx.organizationInvitation.update({
		where: { id: invitation.id },
		data: { status: 'ACCEPTED', acceptedAt: new Date() },
	})
}

const pendingFor = (email: string) => ({
	email: email.toLowerCase(),
	status: 'PENDING' as const,
	expiresAt: { gt: new Date() },
})

/**
 * For someone with no workspace yet (typically a new account created by an
 * invitation): joins everything waiting for their email so they land in a
 * workspace instead of onboarding. People who already belong somewhere choose
 * for themselves on /workspaces. Returns the organizations joined.
 */
export async function joinInvitationsIfNew(userId: string, email: string) {
	const hasWorkspace = await db().organizationMember.count({
		where: { userId, status: 'ACTIVE' },
	})
	if (hasWorkspace) return []

	const invitations = await db().organizationInvitation.findMany({
		where: pendingFor(email),
		include: { groups: true },
		orderBy: { createdAt: 'asc' },
	})
	if (!invitations.length) return []

	await ensureProfile({ sub: userId, email })
	for (const invitation of invitations) {
		await db().$transaction((tx) => joinFromInvitation(tx, invitation, userId))
	}
	return invitations.map((invitation) => invitation.organizationId)
}

async function findOwnInvitation(invitationId: string, email: string) {
	const invitation = await db().organizationInvitation.findFirst({
		where: { id: invitationId, ...pendingFor(email) },
		include: { groups: true },
	})
	if (!invitation) {
		throw new MemberError(
			'That invitation was revoked, has expired or was already used.',
		)
	}
	return invitation
}

/** Accepts one invitation addressed to the signed-in person. Returns the organization joined. */
export async function acceptInvitation(
	userId: string,
	email: string,
	invitationId: string,
) {
	const invitation = await findOwnInvitation(invitationId, email)
	await ensureProfile({ sub: userId, email })
	await db().$transaction((tx) => joinFromInvitation(tx, invitation, userId))
	return invitation.organizationId
}

export async function declineInvitation(
	userId: string,
	email: string,
	invitationId: string,
) {
	const invitation = await findOwnInvitation(invitationId, email)
	await ensureProfile({ sub: userId, email })
	await db().$transaction([
		db().organizationInvitation.update({
			where: { id: invitation.id },
			data: { status: 'DECLINED' },
		}),
		db().auditLog.create({
			data: {
				organizationId: invitation.organizationId,
				actorUserId: userId,
				action: 'member.invitation_declined',
				resourceType: 'invitation',
				resourceId: invitation.id,
				metadata: { email: invitation.email },
			},
		}),
	])
}

/**
 * Removes someone from the workspace: their membership, roles, groups and
 * chat access go; what they created stays. The owner can't be removed, and
 * nobody removes themselves here.
 */
export async function removeMember(
	organizationId: string,
	actorUserId: string,
	membershipId: string,
) {
	await db().$transaction(async (tx) => {
		const membership = await findMembership(tx, organizationId, membershipId)
		if (membership.userId === actorUserId) {
			throw new MemberError('You can’t remove yourself.')
		}
		if (
			highestRole(membership.roles.map(({ role }) => role.name)) === 'OWNER'
		) {
			throw new MemberError('The owner can’t be removed.')
		}
		await tx.organizationMember.delete({ where: { id: membership.id } })
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'member.removed',
				resourceType: 'membership',
				resourceId: membership.id,
				metadata: {
					person: membership.user.displayName,
					email: membership.user.email,
				},
			},
		})
	})
}

/**
 * Where someone goes right after signing in: newcomers join their invitations
 * and go on; people who already have a workspace and new invitations decide
 * on /workspaces first.
 */
export async function landingAfterSignIn(
	identity: { sub: string; email?: string },
	target: string,
) {
	if (!identity.email) return { path: target, joined: [] as string[] }
	const joined = await joinInvitationsIfNew(identity.sub, identity.email)
	if (joined.length) return { path: target, joined }

	const waiting = await db().organizationInvitation.count({
		where: pendingFor(identity.email),
	})
	return { path: waiting ? '/workspaces' : target, joined }
}

/**
 * Where an emailed link leads once it has signed someone in. Invite links and
 * the set-password links sent on resend come from accounts with no password
 * yet, so they choose one first.
 */
export function emailLinkDestination(
	type: string | null,
	landing: { path: string; joined: string[] },
) {
	if (type === 'invite') return '/reset-password?invited=1'
	if (type === 'recovery') {
		return landing.joined.length
			? '/reset-password?invited=1'
			: '/reset-password'
	}
	return landing.path
}
