import {
	documentIndexingState,
	type VersionSnapshot,
} from '~/api/documents/indexing-state'
import { MemberError } from '~/api/members/server'
import { uploadsEnabled } from '~/api/uploads/server'
import type { Prisma } from '~/generated/prisma/client'
import { db } from '~/lib/db.server'

export const COLLECTION_ICONS = [
	'scale',
	'people',
	'building',
	'briefcase',
] as const
const DOCUMENT_LIMIT = 200

const isIcon = (value: string): value is CollectionIconName =>
	(COLLECTION_ICONS as readonly string[]).includes(value)

/**
 * Collections the person may see: everything for owners and admins, otherwise
 * those shared with a group they belong to (Everyone included).
 */
export function visibleCollections(
	session: Session,
): Prisma.CollectionWhereInput {
	const { organization, user } = session
	return user.role === 'MEMBER'
		? {
				organizationId: organization.id,
				groups: {
					some: {
						group: { members: { some: { membership: { userId: user.id } } } },
					},
				},
			}
		: { organizationId: organization.id }
}

const LANGUAGES: Record<string, DocumentLanguage> = {
	en: 'EN',
	fr: 'FR',
	pt: 'PT',
}

export const VERSION_WITH_LATEST_JOB = {
	include: {
		indexingJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
		createdBy: { select: { displayName: true } },
	},
} as const satisfies Prisma.DocumentVersionDefaultArgs

type VersionWithJob = Prisma.DocumentVersionGetPayload<
	typeof VERSION_WITH_LATEST_JOB
>

export function toVersionSnapshot(version: VersionWithJob): VersionSnapshot {
	const job = version.indexingJobs[0]
	return {
		id: version.id,
		versionNumber: version.versionNumber,
		createdById: version.createdById,
		indexed: version.indexedJobId !== null,
		job: job
			? {
					status: job.status,
					stage: job.stage,
					progress: job.progress,
					attempts: job.attempts,
					errorCode: job.errorCode,
				}
			: null,
	}
}

export function fileTypeOf(fileName: string): DocumentFileType {
	const extension = fileName.split('.').pop()?.toUpperCase()
	return extension === 'DOCX' || extension === 'TXT' || extension === 'MD'
		? extension
		: 'PDF'
}

/** The latest job of each live document's newest version, for counts and the failed filter. */
async function latestJobStatuses(
	organizationId: string,
	collectionIds: string[],
) {
	if (!collectionIds.length) return []
	return db().$queryRaw<Array<{ document_id: string; status: string }>>`
		SELECT d.id AS document_id, lj.status::text AS status
		FROM documents d
		JOIN LATERAL (
			SELECT v.id FROM document_versions v
			WHERE v.document_id = d.id ORDER BY v.version_number DESC LIMIT 1
		) lv ON true
		JOIN LATERAL (
			SELECT j.status FROM indexing_jobs j
			WHERE j.document_version_id = lv.id ORDER BY j.created_at DESC LIMIT 1
		) lj ON true
		WHERE d.organization_id = ${organizationId}::uuid
			AND d.deleted_at IS NULL AND d.status = 'ACTIVE'
			AND d.collection_id = ANY(${collectionIds}::uuid[])`
}

const viewerCan = (session: Session, permission: PermissionKey) =>
	session.user.permissions.includes(permission)

/** Documents on the Knowledge page: live, in a collection this person can see. */
export function visibleDocuments(session: Session): Prisma.DocumentWhereInput {
	return {
		organizationId: session.organization.id,
		deletedAt: null,
		status: 'ACTIVE',
		collection: visibleCollections(session),
	}
}

export async function getKnowledgeOverview(
	session: Session,
	filters: {
		collectionId?: string
		templatesOnly?: boolean
		query?: string
		status?: 'failed'
	} = {},
): Promise<KnowledgeOverview> {
	const organizationId = session.organization.id
	const collectionWhere = visibleCollections(session)
	const liveDocument = visibleDocuments(session)

	const [collections, groups, organization] = await Promise.all([
		db().collection.findMany({
			where: collectionWhere,
			orderBy: { name: 'asc' },
			include: {
				groups: { select: { groupId: true } },
				_count: {
					select: {
						documents: { where: { deletedAt: null, status: 'ACTIVE' } },
					},
				},
			},
		}),
		db().group.findMany({
			where: { organizationId },
			orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
			select: { id: true, name: true, isSystem: true },
		}),
		db().organization.findUniqueOrThrow({
			where: { id: organizationId },
			select: { membersCanUpload: true },
		}),
	])
	const latest = await latestJobStatuses(
		organizationId,
		collections.map((collection) => collection.id),
	)
	const failedIds = latest
		.filter((row) => row.status === 'FAILED')
		.map((row) => row.document_id)

	const [documents, total, ready, templates] = await Promise.all([
		db().document.findMany({
			where: {
				...liveDocument,
				...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
				...(filters.templatesOnly
					? { templates: { some: { status: 'ACTIVE' } } }
					: {}),
				...(filters.query
					? { name: { contains: filters.query, mode: 'insensitive' } }
					: {}),
				...(filters.status === 'failed' ? { id: { in: failedIds } } : {}),
			},
			orderBy: { updatedAt: 'desc' },
			take: DOCUMENT_LIMIT,
			include: {
				createdBy: true,
				templates: { where: { status: 'ACTIVE' }, select: { id: true } },
				currentVersion: VERSION_WITH_LATEST_JOB,
				versions: {
					orderBy: { versionNumber: 'desc' },
					take: 1,
					...VERSION_WITH_LATEST_JOB,
				},
			},
		}),
		db().document.count({ where: liveDocument }),
		db().document.count({
			where: { ...liveDocument, currentVersionId: { not: null } },
		}),
		db().document.count({
			where: { ...liveDocument, templates: { some: { status: 'ACTIVE' } } },
		}),
	])

	const viewer = {
		id: session.user.id,
		canUpdate: viewerCan(session, 'documents.update'),
	}

	return {
		collections: collections.map((collection) => ({
			id: collection.id,
			name: collection.name,
			description: collection.description,
			icon: isIcon(collection.icon) ? collection.icon : 'briefcase',
			document_count: collection._count.documents,
			group_ids: collection.groups.map(({ groupId }) => groupId),
		})),
		documents: documents.flatMap((document) => {
			const newest = document.versions[0]
			if (!newest) return []
			const shown = document.currentVersion ?? newest
			return [
				{
					id: document.id,
					name: document.name,
					file_type: fileTypeOf(shown.fileName),
					collection_id: document.collectionId,
					language: LANGUAGES[shown.language?.toLowerCase() ?? ''] ?? 'EN',
					...documentIndexingState({
						current: document.currentVersion
							? toVersionSnapshot(document.currentVersion)
							: null,
						latest: toVersionSnapshot(newest),
						viewer,
					}),
					is_template: document.templates.length > 0,
					pages: shown.pageCount ?? 0,
					uploaded_by: document.createdBy?.displayName ?? '',
					answer_count: 0,
					updated_at: document.updatedAt.toISOString(),
					group_ids: null,
				},
			]
		}),
		stats: {
			total,
			ready,
			processing: latest.filter(
				(row) => row.status === 'QUEUED' || row.status === 'PROCESSING',
			).length,
			failed: failedIds.length,
			templates,
		},
		groups: groups.map((group) => ({
			id: group.id,
			name: group.name,
			is_builtin: group.isSystem,
		})),
		uploads_enabled: uploadsEnabled(),
		can_upload:
			uploadsEnabled() &&
			viewerCan(session, 'documents.create') &&
			(session.user.role !== 'MEMBER' || organization.membersCanUpload),
	}
}

interface CollectionInput {
	name: string
	description: string | null
	icon: CollectionIconName
	groupIds: string[]
}

async function assertNameFree(
	tx: Prisma.TransactionClient,
	organizationId: string,
	name: string,
	exceptId?: string,
) {
	const clash = await tx.collection.findFirst({
		where: {
			organizationId,
			name: { equals: name, mode: 'insensitive' },
			...(exceptId ? { id: { not: exceptId } } : {}),
		},
	})
	if (clash)
		throw new MemberError(`There’s already a collection called ${clash.name}.`)
}

async function groupsIn(
	tx: Prisma.TransactionClient,
	organizationId: string,
	groupIds: string[],
) {
	const ids = [...new Set(groupIds)]
	const groups = await tx.group.findMany({
		where: { organizationId, id: { in: ids } },
		select: { id: true, name: true },
	})
	if (groups.length !== ids.length) {
		throw new MemberError('One of those groups no longer exists.')
	}
	return groups
}

export async function createCollection(
	organizationId: string,
	actorUserId: string,
	input: CollectionInput,
) {
	return db().$transaction(async (tx) => {
		await assertNameFree(tx, organizationId, input.name)
		const groups = await groupsIn(tx, organizationId, input.groupIds)
		const collection = await tx.collection.create({
			data: {
				organizationId,
				name: input.name,
				description: input.description,
				icon: input.icon,
				createdById: actorUserId,
				groups: { create: groups.map((group) => ({ groupId: group.id })) },
			},
		})
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'collection.created',
				resourceType: 'collection',
				resourceId: collection.id,
				metadata: {
					name: input.name,
					groups: groups.map((group) => group.name),
				},
			},
		})
		return collection
	})
}

/** Saves name, description, icon and access together, as the edit sheet submits them. */
export async function updateCollection(
	organizationId: string,
	actorUserId: string,
	collectionId: string,
	input: CollectionInput,
) {
	await db().$transaction(async (tx) => {
		const collection = await tx.collection.findFirst({
			where: { id: collectionId, organizationId },
			include: { groups: { include: { group: true } } },
		})
		if (!collection) throw new MemberError('That collection no longer exists.')
		await assertNameFree(tx, organizationId, input.name, collection.id)
		const groups = await groupsIn(tx, organizationId, input.groupIds)

		await tx.collection.update({
			where: { id: collection.id },
			data: {
				name: input.name,
				description: input.description,
				icon: input.icon,
			},
		})
		await tx.collectionGroup.deleteMany({
			where: {
				collectionId: collection.id,
				groupId: { notIn: groups.map((group) => group.id) },
			},
		})
		await tx.collectionGroup.createMany({
			data: groups.map((group) => ({
				organizationId,
				collectionId: collection.id,
				groupId: group.id,
			})),
			skipDuplicates: true,
		})

		const before = collection.groups.map(({ group }) => group.name).sort()
		const after = groups.map((group) => group.name).sort()
		const changed = [
			collection.name !== input.name && 'name',
			(collection.description ?? null) !== input.description && 'description',
			collection.icon !== input.icon && 'icon',
			before.join() !== after.join() && 'access',
		].filter(Boolean)
		if (!changed.length) return
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'collection.updated',
				resourceType: 'collection',
				resourceId: collection.id,
				metadata: {
					name: input.name,
					changes: changed as string[],
					...(collection.name !== input.name ? { from: collection.name } : {}),
					...(before.join() !== after.join() ? { groups: after } : {}),
				},
			},
		})
	})
}

/** Deletes an empty collection. Documents must be moved or deleted first. */
export async function deleteCollection(
	organizationId: string,
	actorUserId: string,
	collectionId: string,
) {
	await db().$transaction(async (tx) => {
		const collection = await tx.collection.findFirst({
			where: { id: collectionId, organizationId },
			include: { _count: { select: { documents: true, children: true } } },
		})
		if (!collection) throw new MemberError('That collection no longer exists.')
		if (collection._count.documents) {
			throw new MemberError(
				`${collection.name} still has ${collection._count.documents} document${collection._count.documents === 1 ? '' : 's'}. Move or delete them first.`,
			)
		}
		if (collection._count.children) {
			throw new MemberError(
				`${collection.name} has collections inside it. Delete those first.`,
			)
		}
		await tx.collection.delete({ where: { id: collection.id } })
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId,
				action: 'collection.deleted',
				resourceType: 'collection',
				resourceId: collection.id,
				metadata: { name: collection.name },
			},
		})
	})
}
