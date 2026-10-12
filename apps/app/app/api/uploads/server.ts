import { randomUUID } from 'node:crypto'
import { hasValidSignature } from './file-signature'
import {
	UPLOAD_TOKEN_TTL_MS,
	signUploadToken,
	verifyUploadToken,
	type UploadClaims,
} from './token.server'
import { UploadError, fileTypeLabel, validateUpload } from './validation'
import { visibleCollections } from '~/api/collections/server'
import { dispatchIndexing, enqueueIndexing } from '~/api/indexing/server'
import { Prisma } from '~/generated/prisma/client'
import { environmentVariables } from '~/lib/actions/env.server'
import { db } from '~/lib/db.server'
import { objectStore, type ObjectStore } from '~/lib/object-store.server'

const PUT_EXPIRY_SECONDS = 10 * 60
const ZIP_TAIL_BYTES = 65_557
const VERSION_RETRIES = 3

export interface UploadDeps {
	store?: ObjectStore
	now?: number
	dispatch?: (eventId: string) => Promise<void>
	enabled?: boolean
}

export interface InitiatedUpload {
	upload_url: string
	headers: Record<string, string>
	token: string
}

export function uploadsEnabled() {
	return environmentVariables().UPLOADS_ENABLED && objectStore() !== null
}

function requireStore(deps: UploadDeps) {
	const enabled = deps.enabled ?? environmentVariables().UPLOADS_ENABLED
	const store = deps.store ?? objectStore()
	if (!enabled || !store)
		throw new UploadError('Uploads aren’t available right now.')
	return store
}

const can = (session: Session, permission: PermissionKey) =>
	session.user.permissions.includes(permission)

/** Re-checked at complete, so access removed after initiate still blocks the upload. */
async function resolveTarget(
	session: Session,
	target: { collectionId?: string; documentId?: string | null },
) {
	const organizationId = session.organization.id
	if (target.documentId) {
		if (!can(session, 'documents.update')) {
			throw new UploadError('You don’t have permission to replace documents.')
		}
		const document = await db().document.findFirst({
			where: {
				id: target.documentId,
				organizationId,
				deletedAt: null,
				status: 'ACTIVE',
				collection: visibleCollections(session),
			},
			select: { id: true, collectionId: true, name: true },
		})
		if (!document)
			throw new UploadError('That document is no longer available.')
		return { collectionId: document.collectionId, document }
	}
	if (!can(session, 'documents.create')) {
		throw new UploadError('You don’t have permission to upload documents.')
	}
	if (session.user.role === 'MEMBER') {
		const organization = await db().organization.findUniqueOrThrow({
			where: { id: organizationId },
			select: { membersCanUpload: true },
		})
		if (!organization.membersCanUpload) {
			throw new UploadError(
				'Uploads are limited to owners and admins in this workspace.',
			)
		}
	}
	const collection = target.collectionId
		? await db().collection.findFirst({
				where: {
					AND: [{ id: target.collectionId }, visibleCollections(session)],
				},
				select: { id: true },
			})
		: null
	if (!collection)
		throw new UploadError('That collection is no longer available.')
	return { collectionId: collection.id, document: null }
}

export async function initiateUpload(
	session: Session,
	input: {
		collectionId?: string
		documentId?: string
		fileName: string
		size: number
		contentType: string
	},
	deps: UploadDeps = {},
): Promise<InitiatedUpload> {
	const store = requireStore(deps)
	const file = validateUpload(input)
	const { collectionId, document } = await resolveTarget(session, input)
	const uploadId = randomUUID()
	const stagingKey = `staging/${session.organization.id}/${uploadId}`
	const claims: UploadClaims = {
		upload_id: uploadId,
		organization_id: session.organization.id,
		user_id: session.user.id,
		collection_id: collectionId,
		document_id: document?.id ?? null,
		file_name: file.fileName,
		extension: file.extension,
		content_type: file.contentType,
		size: input.size,
		staging_key: stagingKey,
		expires_at: (deps.now ?? Date.now()) + UPLOAD_TOKEN_TTL_MS,
	}
	return {
		upload_url: await store.presignPut(stagingKey, {
			contentType: file.contentType,
			expiresInSeconds: PUT_EXPIRY_SECONDS,
		}),
		headers: { 'Content-Type': file.contentType },
		token: signUploadToken(claims, environmentVariables().SESSION_SECRET),
	}
}

async function verifyStagedObject(store: ObjectStore, claims: UploadClaims) {
	const staged = await store.head(claims.staging_key)
	const stagedType = staged?.contentType?.split(';')[0]?.trim().toLowerCase()
	if (
		!staged ||
		staged.size !== claims.size ||
		stagedType !== claims.content_type
	) {
		throw new UploadError('The upload didn’t finish. Add the file again.')
	}
	const head = await store.readRange(claims.staging_key, {
		start: 0,
		end: 4095,
	})
	const tail =
		claims.extension === 'docx'
			? await store.readRange(claims.staging_key, { suffix: ZIP_TAIL_BYTES })
			: new Uint8Array()
	if (!hasValidSignature(claims.extension, head, tail)) {
		throw new UploadError(
			`That file isn’t a valid ${fileTypeLabel(claims.extension)}.`,
		)
	}
}

const displayName = (fileName: string) =>
	fileName.replace(/\.[^.]+$/, '') || fileName

async function createRecords(
	session: Session,
	claims: UploadClaims,
	fileKey: string,
) {
	const organizationId = session.organization.id
	return db().$transaction(async (tx) => {
		let documentId = claims.document_id
		let versionNumber = 1
		if (documentId) {
			await tx.$queryRaw`SELECT id FROM documents WHERE id = ${documentId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE`
			const latest = await tx.documentVersion.aggregate({
				where: { documentId },
				_max: { versionNumber: true },
			})
			versionNumber = (latest._max.versionNumber ?? 0) + 1
		} else {
			const document = await tx.document.create({
				data: {
					organizationId,
					collectionId: claims.collection_id,
					name: displayName(claims.file_name),
					createdById: session.user.id,
				},
			})
			documentId = document.id
		}
		if (claims.document_id) {
			await tx.document.update({
				where: { id: documentId },
				data: { updatedAt: new Date() },
			})
		}
		const version = await tx.documentVersion.create({
			data: {
				organizationId,
				documentId,
				versionNumber,
				uploadId: claims.upload_id,
				fileKey,
				fileName: claims.file_name,
				mimeType: claims.content_type,
				fileSize: BigInt(claims.size),
				createdById: session.user.id,
			},
		})
		const { eventId } = await enqueueIndexing(tx, {
			organizationId,
			documentId,
			documentVersionId: version.id,
			trigger: 'UPLOAD',
			actorId: session.user.id,
		})
		const name = claims.document_id
			? (await tx.document.findUniqueOrThrow({ where: { id: documentId } }))
					.name
			: displayName(claims.file_name)
		await tx.auditLog.create({
			data: {
				organizationId,
				actorUserId: session.user.id,
				action: claims.document_id
					? 'document.version_uploaded'
					: 'document.uploaded',
				resourceType: 'document',
				resourceId: documentId,
				metadata: {
					target: name,
					version: versionNumber,
					file_name: claims.file_name,
				},
			},
		})
		return { documentId, eventId }
	})
}

async function existingUpload(uploadId: string, organizationId: string) {
	const version = await db().documentVersion.findFirst({
		where: { uploadId, organizationId },
		select: { documentId: true },
	})
	return version ? { document_id: version.documentId, event_id: null } : null
}

export async function completeUpload(
	session: Session,
	token: string,
	deps: UploadDeps = {},
) {
	const store = requireStore(deps)
	const claims = verifyUploadToken(
		token,
		environmentVariables().SESSION_SECRET,
		deps.now,
	)
	if (
		claims.organization_id !== session.organization.id ||
		claims.user_id !== session.user.id
	) {
		throw new UploadError('This upload isn’t valid. Add the file again.')
	}
	const done = await existingUpload(claims.upload_id, claims.organization_id)
	if (done) return done

	await resolveTarget(session, {
		collectionId: claims.collection_id,
		documentId: claims.document_id,
	})
	await verifyStagedObject(store, claims)

	const fileKey = `org/${claims.organization_id}/uploads/${claims.upload_id}/source.${claims.extension}`
	await store.copy(claims.staging_key, fileKey)

	const copied = await store.head(fileKey)
	if (!copied || copied.size !== claims.size) {
		await store.remove(fileKey).catch(() => {})
		throw new UploadError('The upload didn’t finish. Add the file again.')
	}

	let committed: { documentId: string; eventId: string }
	for (let attempt = 1; ; attempt++) {
		try {
			committed = await createRecords(session, claims, fileKey)
			break
		} catch (error) {
			const finished = await existingUpload(
				claims.upload_id,
				claims.organization_id,
			).catch(() => null)
			if (finished) return finished
			const isUniqueClash =
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			if (isUniqueClash && attempt < VERSION_RETRIES) continue
			await store.remove(fileKey).catch(() => {})
			throw error
		}
	}

	try {
		await (deps.dispatch ?? dispatchIndexing)(committed.eventId)
	} catch {
		console.error('Indexing dispatch failed', { eventId: committed.eventId })
	}
	return { document_id: committed.documentId, event_id: committed.eventId }
}
