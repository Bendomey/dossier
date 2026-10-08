import { MemberError } from '~/api/members/server'
import { Prisma } from '~/generated/prisma/client'
import { db } from '~/lib/db.server'

const ROLE_BY_NAME: Record<string, MemberRole> = {
	Owner: 'OWNER',
	Admin: 'ADMIN',
	Member: 'MEMBER',
}

const highestRole = (names: string[]): MemberRole => {
	const roles = names.map((name) => ROLE_BY_NAME[name]).filter(Boolean)
	return roles.includes('OWNER')
		? 'OWNER'
		: roles.includes('ADMIN')
			? 'ADMIN'
			: 'MEMBER'
}

const isUniqueViolation = (error: unknown) =>
	error instanceof Prisma.PrismaClientKnownRequestError &&
	error.code === 'P2002'

export async function getGroupsOverview(
	organizationId: string,
): Promise<GroupsOverview> {
	const [groups, members, collections] = await Promise.all([
		db().group.findMany({
			where: { organizationId },
			orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
			include: {
				members: { select: { membershipId: true } },
				collections: { select: { collectionId: true } },
			},
		}),
		db().organizationMember.findMany({
			where: { organizationId, status: 'ACTIVE' },
			orderBy: { joinedAt: 'asc' },
			include: { user: true, roles: { include: { role: true } } },
		}),
		db().collection.findMany({
			where: { organizationId },
			orderBy: { name: 'asc' },
			select: { id: true, name: true },
		}),
	])

	return {
		groups: groups.map((group) => ({
			id: group.id,
			name: group.name,
			is_system: group.isSystem,
			membership_ids: group.members.map(({ membershipId }) => membershipId),
			collection_ids: group.collections.map(({ collectionId }) => collectionId),
		})),
		members: members.map((member) => ({
			membership_id: member.id,
			name: member.user.displayName ?? member.user.email ?? 'Unnamed',
			role: highestRole(member.roles.map(({ role }) => role.name)),
		})),
		collections,
	}
}

async function findEditableGroup(
	tx: Prisma.TransactionClient,
	organizationId: string,
	groupId: string,
) {
	const group = await tx.group.findFirst({
		where: { id: groupId, organizationId },
	})
	if (!group) throw new MemberError('That group no longer exists.')
	if (group.isSystem)
		throw new MemberError('Everyone is built in and can’t be changed.')
	return group
}

const audit = (
	tx: Prisma.TransactionClient,
	organizationId: string,
	actorUserId: string,
	action: string,
	resourceId: string,
	metadata: Prisma.InputJsonObject,
) =>
	tx.auditLog.create({
		data: {
			organizationId,
			actorUserId,
			action,
			resourceType: 'group',
			resourceId,
			metadata,
		},
	})

/**
 * Creates a group with its first members and the collections it can see.
 * Members must be active in this workspace and collections belong to it.
 */
export async function createGroup(
	organizationId: string,
	actorUserId: string,
	input: { name: string; membershipIds: string[]; collectionIds: string[] },
) {
	try {
		return await db().$transaction(async (tx) => {
			const membershipIds = [...new Set(input.membershipIds)]
			const collectionIds = [...new Set(input.collectionIds)]
			const [members, collections] = await Promise.all([
				tx.organizationMember.count({
					where: {
						organizationId,
						status: 'ACTIVE',
						id: { in: membershipIds },
					},
				}),
				tx.collection.count({
					where: { organizationId, id: { in: collectionIds } },
				}),
			])
			if (
				members !== membershipIds.length ||
				collections !== collectionIds.length
			) {
				throw new MemberError(
					'Someone or a collection you picked is no longer in this workspace.',
				)
			}

			const group = await tx.group.create({
				data: {
					organizationId,
					name: input.name,
					createdById: actorUserId,
					members: {
						create: membershipIds.map((membershipId) => ({ membershipId })),
					},
					collections: {
						create: collectionIds.map((collectionId) => ({ collectionId })),
					},
				},
			})
			await audit(tx, organizationId, actorUserId, 'group.created', group.id, {
				name: input.name,
				member_count: membershipIds.length,
				collection_count: collectionIds.length,
			})
			return group
		})
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new MemberError(`There’s already a group called ${input.name}.`)
		}
		throw error
	}
}

export async function renameGroup(
	organizationId: string,
	actorUserId: string,
	groupId: string,
	name: string,
) {
	try {
		await db().$transaction(async (tx) => {
			const group = await findEditableGroup(tx, organizationId, groupId)
			if (group.name === name) return
			await tx.group.update({ where: { id: group.id }, data: { name } })
			await audit(tx, organizationId, actorUserId, 'group.renamed', group.id, {
				from: group.name,
				to: name,
			})
		})
	} catch (error) {
		if (isUniqueViolation(error)) {
			throw new MemberError(`There’s already a group called ${name}.`)
		}
		throw error
	}
}

/** Deletes a group. Its members stay in the workspace; access it granted goes with it. */
export async function deleteGroup(
	organizationId: string,
	actorUserId: string,
	groupId: string,
) {
	await db().$transaction(async (tx) => {
		const group = await findEditableGroup(tx, organizationId, groupId)
		await tx.group.delete({ where: { id: group.id } })
		await audit(tx, organizationId, actorUserId, 'group.deleted', group.id, {
			name: group.name,
		})
	})
}

export async function setGroupMember(
	organizationId: string,
	actorUserId: string,
	input: { groupId: string; membershipId: string; included: boolean },
) {
	await db().$transaction(async (tx) => {
		const group = await findEditableGroup(tx, organizationId, input.groupId)
		const membership = await tx.organizationMember.findFirst({
			where: { id: input.membershipId, organizationId, status: 'ACTIVE' },
			include: { user: true },
		})
		if (!membership)
			throw new MemberError('That person is no longer in this workspace.')

		if (input.included) {
			await tx.groupMember.upsert({
				where: {
					groupId_membershipId: {
						groupId: group.id,
						membershipId: membership.id,
					},
				},
				create: {
					organizationId,
					groupId: group.id,
					membershipId: membership.id,
				},
				update: {},
			})
		} else {
			await tx.groupMember.deleteMany({
				where: { groupId: group.id, membershipId: membership.id },
			})
		}
		await audit(
			tx,
			organizationId,
			actorUserId,
			input.included ? 'group.member_added' : 'group.member_removed',
			group.id,
			{ group: group.name, person: membership.user.displayName },
		)
	})
}

/** Gives a group (Everyone included) read access to a collection, or takes it away. */
export async function setCollectionAccess(
	organizationId: string,
	actorUserId: string,
	input: { groupId: string; collectionId: string; visible: boolean },
) {
	await db().$transaction(async (tx) => {
		const [group, collection] = await Promise.all([
			tx.group.findFirst({ where: { id: input.groupId, organizationId } }),
			tx.collection.findFirst({
				where: { id: input.collectionId, organizationId },
			}),
		])
		if (!group || !collection) {
			throw new MemberError('That group or collection no longer exists.')
		}

		if (input.visible) {
			await tx.collectionGroup.upsert({
				where: {
					collectionId_groupId: {
						collectionId: collection.id,
						groupId: group.id,
					},
				},
				create: {
					organizationId,
					collectionId: collection.id,
					groupId: group.id,
				},
				update: {},
			})
		} else {
			await tx.collectionGroup.deleteMany({
				where: { collectionId: collection.id, groupId: group.id },
			})
		}
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'collection.access_changed',
				resourceType: 'collection',
				resourceId: collection.id,
				metadata: {
					group: group.name,
					collection: collection.name,
					access: input.visible ? 'read' : 'none',
				},
			},
		})
	})
}
