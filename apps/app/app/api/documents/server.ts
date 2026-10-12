import { canRetryCode, indexingErrorMessage } from './indexing-errors'
import { documentIndexingState, versionIndexingState } from './indexing-state'
import {
	VERSION_WITH_LATEST_JOB,
	fileTypeOf,
	toVersionSnapshot,
	visibleCollections,
} from '~/api/collections/server'
import { dispatchIndexing, enqueueIndexing } from '~/api/indexing/server'
import { MemberError } from '~/api/members/server'
import { uploadsEnabled } from '~/api/uploads/server'
import { db } from '~/lib/db.server'
import { objectStore, type ObjectStore } from '~/lib/object-store.server'

const DOWNLOAD_EXPIRY_SECONDS = 5 * 60
const LANGUAGES: Record<string, DocumentLanguage> = {
	en: 'EN',
	fr: 'FR',
	pt: 'PT',
}

const can = (session: Session, permission: PermissionKey) =>
	session.user.permissions.includes(permission)

async function findVisibleDocument(session: Session, documentId: string) {
	const document = await db().document.findFirst({
		where: {
			id: documentId,
			organizationId: session.organization.id,
			deletedAt: null,
			status: 'ACTIVE',
			collection: visibleCollections(session),
		},
		include: {
			collection: { select: { name: true } },
			createdBy: { select: { displayName: true } },
			templates: { where: { status: 'ACTIVE' }, select: { id: true } },
			currentVersion: VERSION_WITH_LATEST_JOB,
			versions: {
				orderBy: { versionNumber: 'desc' },
				...VERSION_WITH_LATEST_JOB,
			},
		},
	})
	if (!document || !document.versions.length) {
		throw new Response('Document not found', { status: 404 })
	}
	return document
}

export async function getDocumentDetail(
	session: Session,
	documentId: string,
): Promise<DocumentDetail> {
	const document = await findVisibleDocument(session, documentId)
	const viewer = {
		id: session.user.id,
		canUpdate: can(session, 'documents.update'),
	}
	const newest = document.versions[0]!
	const shown = document.currentVersion ?? newest
	const liveNumber = document.currentVersion?.versionNumber ?? 0
	return {
		document: {
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
		collection_name: document.collection.name,
		versions: document.versions.map((version) => {
			const state = versionIndexingState(toVersionSnapshot(version), viewer)
			return {
				id: version.id,
				version_number: version.versionNumber,
				file_name: version.fileName,
				status: state.status,
				progress: state.progress,
				error: state.error,
				can_retry: state.can_retry && version.versionNumber >= liveNumber,
				is_current: version.id === document.currentVersionId,
				page_count: version.pageCount,
				uploaded_by: version.createdBy?.displayName ?? '',
				created_at: version.createdAt.toISOString(),
			}
		}),
		can_upload_version: can(session, 'documents.update') && uploadsEnabled(),
		can_remove: can(session, 'documents.delete'),
	}
}

export async function retryIndexing(
	session: Session,
	documentId: string,
	versionId: string,
	deps: { dispatch?: (eventId: string) => Promise<void> } = {},
) {
	const document = await findVisibleDocument(session, documentId)
	const version = document.versions.find((item) => item.id === versionId)
	if (!version) throw new MemberError('That version no longer exists.')
	if (version.versionNumber < (document.currentVersion?.versionNumber ?? 0)) {
		throw new MemberError('A newer version is already live.')
	}
	if (
		!can(session, 'documents.update') &&
		version.createdById !== session.user.id
	) {
		throw new MemberError('You can only retry your own uploads.')
	}

	const eventId = await db().$transaction(async (tx) => {
		await tx.$queryRaw`SELECT id FROM document_versions WHERE id = ${versionId}::uuid FOR UPDATE`
		const latest = await tx.indexingJob.findFirst({
			where: { documentVersionId: versionId },
			orderBy: { createdAt: 'desc' },
		})
		if (
			latest &&
			(latest.status === 'QUEUED' || latest.status === 'PROCESSING')
		) {
			return null
		}
		if (latest?.status !== 'FAILED' || version.indexedJobId) {
			throw new MemberError('This version is already indexed.')
		}
		if (!canRetryCode(latest.errorCode)) {
			throw new MemberError(indexingErrorMessage(latest.errorCode))
		}
		const { eventId } = await enqueueIndexing(tx, {
			organizationId: session.organization.id,
			documentId,
			documentVersionId: versionId,
			trigger: 'RETRY',
			actorId: session.user.id,
		})
		await tx.auditLog.create({
			data: {
				organizationId: session.organization.id,
				actorUserId: session.user.id,
				action: 'document.indexing_retried',
				resourceType: 'document',
				resourceId: documentId,
				metadata: { target: document.name, version: version.versionNumber },
			},
		})
		return eventId
	})
	if (eventId) await (deps.dispatch ?? dispatchIndexing)(eventId)
}

export async function removeDocument(session: Session, documentId: string) {
	const document = await findVisibleDocument(session, documentId)
	await db().$transaction([
		db().document.update({
			where: { id: document.id },
			data: { deletedAt: new Date(), status: 'DELETED' },
		}),
		db().auditLog.create({
			data: {
				organizationId: session.organization.id,
				actorUserId: session.user.id,
				action: 'document.removed',
				resourceType: 'document',
				resourceId: document.id,
				metadata: { target: document.name },
			},
		}),
	])
}

export async function versionDownloadUrl(
	session: Session,
	documentId: string,
	versionId: string,
	store: ObjectStore | null = objectStore(),
) {
	const document = await findVisibleDocument(session, documentId)
	const version = document.versions.find((item) => item.id === versionId)
	if (!version || !store) throw new Response('Not found', { status: 404 })
	return store.presignGet(version.fileKey, {
		expiresInSeconds: DOWNLOAD_EXPIRY_SECONDS,
		downloadName: version.fileName,
	})
}
