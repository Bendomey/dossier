import { visibleCollections, visibleDocuments } from '~/api/collections/server'
import { Prisma, type MessageStatus } from '~/generated/prisma/client'
import type {
	CitedPassage,
	HistoryTurn,
	ReplyOrganization,
	ReplyOutcome,
} from '~/lib/ai/operations/types'
import { sectionLabel } from '~/lib/ai/sources.server'
import { db } from '~/lib/db.server'

const CHAT_PAGE_SIZE = 30
export const CHAT_TITLE_MAX = 100
const TITLE_LENGTH = 60
const QUOTE_LENGTH = 300
const ACTIVE_REPLY: MessageStatus[] = ['PENDING', 'STREAMING']

export const RETRYABLE_ERRORS = new Set([
	'PROVIDER_UNAVAILABLE',
	'RETRIEVAL_FAILED',
	'STALLED',
	'INTERNAL',
])

const CLIENT_STATUS: Record<
	MessageStatus,
	NonNullable<ChatMessage['status']>
> = {
	PENDING: 'PENDING',
	STREAMING: 'STREAMING',
	COMPLETED: 'DONE',
	FAILED: 'FAILED',
	CANCELLED: 'CANCELLED',
}

export class ChatRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly code: string,
	) {
		super(message)
	}
}

const chatNotFound = () =>
	new ChatRequestError('This chat isn’t available.', 404, 'NOT_FOUND')

const isUniqueViolation = (error: unknown) =>
	error instanceof Prisma.PrismaClientKnownRequestError &&
	error.code === 'P2002'

/** Chats are private to their creator until sharing exists. */
const ownChats = (session: Session) => ({
	organizationId: session.organization.id,
	createdById: session.user.id,
	status: 'ACTIVE' as const,
})

const MESSAGE_INCLUDE = {
	citations: {
		orderBy: { citationOrder: 'asc' },
		include: {
			document: { select: { name: true } },
			documentVersion: { select: { versionNumber: true } },
		},
	},
} satisfies Prisma.ChatMessageInclude

type StoredMessage = Prisma.ChatMessageGetPayload<{
	include: typeof MESSAGE_INCLUDE
}>

export interface StartedReply {
	chatId: string
	assistantMessageId: string
	created: boolean
}

function metadataOf(value: Prisma.JsonValue): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value)
		? value
		: {}
}

function titleOf(prompt: string) {
	const line = prompt.replace(/\s+/g, ' ').trim()
	if (line.length <= TITLE_LENGTH) return line
	const cut = line.slice(0, TITLE_LENGTH)
	const space = cut.lastIndexOf(' ')
	return `${space > 20 ? cut.slice(0, space) : cut}…`
}

async function readableDocumentIds(
	session: Session,
	messages: StoredMessage[],
) {
	const ids = [
		...new Set(
			messages.flatMap((message) =>
				message.citations.map((citation) => citation.documentId),
			),
		),
	]
	if (!ids.length) return new Set<string>()
	const documents = await db().document.findMany({
		where: { ...visibleDocuments(session), id: { in: ids } },
		select: { id: true },
	})
	return new Set(documents.map((document) => document.id))
}

function toClientMessage(
	message: StoredMessage,
	readable: Set<string>,
): ChatMessage {
	if (message.role === 'USER') {
		return { id: message.id, role: 'USER', text: message.content }
	}
	const metadata = metadataOf(message.metadata)
	return {
		id: message.id,
		role: 'ASSISTANT',
		text: message.content,
		status: CLIENT_STATUS[message.status],
		status_label:
			typeof metadata.status_label === 'string'
				? metadata.status_label
				: undefined,
		citations: message.citations.map((citation) => {
			const available = readable.has(citation.documentId)
			return {
				order: citation.citationOrder,
				document_id: citation.documentId,
				document_name: available ? citation.document.name : null,
				version_id: citation.documentVersionId,
				version_number: available
					? citation.documentVersion.versionNumber
					: null,
				page: available ? citation.pageNumber : null,
				page_end: available ? citation.pageEnd : null,
				section: available
					? sectionLabel(citation.sectionNumber, citation.sectionTitle)
					: null,
				available,
			}
		}),
		error: message.errorCode
			? {
					code: message.errorCode,
					retryable: RETRYABLE_ERRORS.has(message.errorCode),
				}
			: undefined,
		unsupported: metadata.unsupported === true,
		clarifying: metadata.clarifying === true,
	}
}

export function citationFromPassage({
	order,
	passage,
}: CitedPassage): Citation {
	return {
		order,
		document_id: passage.documentId,
		document_name: passage.documentName,
		version_id: passage.versionId,
		version_number: passage.versionNumber,
		page: passage.pageStart,
		page_end: passage.pageEnd,
		section: sectionLabel(passage.sectionNumber, passage.sectionTitle),
		available: true,
	}
}

const encodeCursor = (updatedAt: Date, id: string) =>
	Buffer.from(`${updatedAt.toISOString()}|${id}`).toString('base64url')

function decodeCursor(cursor: string) {
	const [time, id] = Buffer.from(cursor, 'base64url').toString().split('|')
	const updatedAt = new Date(time ?? '')
	return id && !Number.isNaN(updatedAt.getTime()) ? { updatedAt, id } : null
}

/** Newest-updated first, keyset-paged on (updated_at, id). */
export async function listChats(
	session: Session,
	cursor: string | null,
): Promise<ChatPage> {
	const after = cursor ? decodeCursor(cursor) : null
	const chats = await db().chat.findMany({
		where: {
			...ownChats(session),
			...(after && {
				OR: [
					{ updatedAt: { lt: after.updatedAt } },
					{ updatedAt: after.updatedAt, id: { lt: after.id } },
				],
			}),
		},
		orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
		take: CHAT_PAGE_SIZE + 1,
		select: { id: true, title: true, createdAt: true, updatedAt: true },
	})
	const page = chats.slice(0, CHAT_PAGE_SIZE)
	const last = page.at(-1)
	return {
		chats: page.map((chat) => ({
			id: chat.id,
			title: chat.title,
			created_at: chat.createdAt.toISOString(),
		})),
		next_cursor:
			chats.length > CHAT_PAGE_SIZE && last
				? encodeCursor(last.updatedAt, last.id)
				: null,
	}
}

async function ownChatId(session: Session, chatId: string) {
	const chat = await db().chat.findFirst({
		where: { id: chatId, ...ownChats(session) },
		select: { id: true },
	})
	if (!chat) throw chatNotFound()
	return chat.id
}

export async function renameChat(
	session: Session,
	chatId: string,
	title: string,
) {
	const id = await ownChatId(session, chatId)
	await db().$transaction([
		db().chat.update({ where: { id }, data: { title } }),
		db().auditLog.create({
			data: {
				organizationId: session.organization.id,
				actorUserId: session.user.id,
				action: 'chat.renamed',
				resourceType: 'chat',
				resourceId: id,
			},
		}),
	])
}

/** Archiving is the only way to remove a chat: its messages stay, it just leaves every list and URL. */
export async function archiveChat(session: Session, chatId: string) {
	const id = await ownChatId(session, chatId)
	await db().$transaction([
		db().chat.update({
			where: { id },
			data: { status: 'ARCHIVED', archivedAt: new Date() },
		}),
		db().auditLog.create({
			data: {
				organizationId: session.organization.id,
				actorUserId: session.user.id,
				action: 'chat.archived',
				resourceType: 'chat',
				resourceId: id,
			},
		}),
	])
}

export async function getChat(session: Session, chatId: string): Promise<Chat> {
	const chat = await db().chat.findFirst({
		where: { id: chatId, ...ownChats(session) },
		include: {
			messages: {
				where: { role: { in: ['USER', 'ASSISTANT'] } },
				orderBy: { sequence: 'asc' },
				include: MESSAGE_INCLUDE,
			},
		},
	})
	if (!chat) throw chatNotFound()
	const readable = await readableDocumentIds(session, chat.messages)
	return {
		id: chat.id,
		title: chat.title,
		created_at: chat.createdAt.toISOString(),
		messages: chat.messages.map((message) =>
			toClientMessage(message, readable),
		),
	}
}

export async function getReply(
	session: Session,
	chatId: string,
	messageId: string,
): Promise<ChatMessage> {
	const message = await db().chatMessage.findFirst({
		where: {
			id: messageId,
			chatId,
			role: 'ASSISTANT',
			chat: ownChats(session),
		},
		include: MESSAGE_INCLUDE,
	})
	if (!message) throw chatNotFound()
	return toClientMessage(message, await readableDocumentIds(session, [message]))
}

export async function listChatCollections(
	session: Session,
): Promise<ChatCollectionOption[]> {
	return db().collection.findMany({
		where: visibleCollections(session),
		orderBy: { name: 'asc' },
		select: { id: true, name: true },
	})
}

async function existingExchange(
	session: Session,
	idempotencyKey: string,
): Promise<StartedReply | null> {
	const question = await db().chatMessage.findFirst({
		where: {
			organizationId: session.organization.id,
			createdById: session.user.id,
			idempotencyKey,
		},
		select: { chatId: true, sequence: true },
	})
	if (!question) return null
	const reply = await db().chatMessage.findFirst({
		where: { chatId: question.chatId, sequence: question.sequence + 1 },
		select: { id: true },
	})
	return reply
		? { chatId: question.chatId, assistantMessageId: reply.id, created: false }
		: null
}

function exchange(
	session: Session,
	input: NewMessageInput & { idempotencyKey: string },
	sequence: number,
) {
	return {
		question: {
			role: 'USER' as const,
			content: input.prompt,
			sequence,
			operation: input.mode,
			idempotencyKey: input.idempotencyKey,
			createdById: session.user.id,
		},
		reply: {
			role: 'ASSISTANT' as const,
			content: '',
			sequence: sequence + 1,
			status: 'PENDING' as const,
		},
	}
}

export async function createChat(
	session: Session,
	input: NewChatInput & { idempotencyKey: string },
): Promise<StartedReply> {
	const existing = await existingExchange(session, input.idempotencyKey)
	if (existing) return existing

	if (input.collectionId) {
		const collection = await db().collection.findFirst({
			where: { ...visibleCollections(session), id: input.collectionId },
			select: { id: true },
		})
		if (!collection) {
			throw new ChatRequestError(
				'That collection isn’t available.',
				404,
				'NOT_FOUND',
			)
		}
	}

	const organizationId = session.organization.id
	const { question, reply } = exchange(session, input, 1)
	try {
		return await db().$transaction(async (tx) => {
			const chat = await tx.chat.create({
				data: {
					organizationId,
					createdById: session.user.id,
					title: titleOf(input.prompt),
					collections: input.collectionId
						? { create: [{ collectionId: input.collectionId }] }
						: undefined,
					messages: { create: [question, reply] },
				},
				select: {
					id: true,
					messages: { where: { role: 'ASSISTANT' }, select: { id: true } },
				},
			})
			await tx.auditLog.create({
				data: {
					organizationId,
					actorUserId: session.user.id,
					action: 'chat.created',
					resourceType: 'chat',
					resourceId: chat.id,
				},
			})
			return {
				chatId: chat.id,
				assistantMessageId: chat.messages[0]!.id,
				created: true,
			}
		})
	} catch (error) {
		const raced = isUniqueViolation(error)
			? await existingExchange(session, input.idempotencyKey)
			: null
		if (raced) return raced
		throw error
	}
}

export async function sendMessage(
	session: Session,
	chatId: string,
	input: NewMessageInput & { idempotencyKey: string },
): Promise<StartedReply> {
	const existing = await existingExchange(session, input.idempotencyKey)
	if (existing) {
		if (existing.chatId !== chatId) throw chatNotFound()
		return existing
	}
	const chat = await db().chat.findFirst({
		where: { id: chatId, ...ownChats(session) },
		select: { id: true },
	})
	if (!chat) throw chatNotFound()

	const organizationId = session.organization.id
	const inProgress = new ChatRequestError(
		'Wait for the current answer to finish.',
		409,
		'REPLY_IN_PROGRESS',
	)
	try {
		return await db().$transaction(async (tx) => {
			const busy = await tx.chatMessage.count({
				where: { chatId, role: 'ASSISTANT', status: { in: ACTIVE_REPLY } },
			})
			if (busy) throw inProgress
			const last = await tx.chatMessage.aggregate({
				where: { chatId },
				_max: { sequence: true },
			})
			const { question, reply } = exchange(
				session,
				input,
				(last._max.sequence ?? 0) + 1,
			)
			await tx.chatMessage.create({
				data: { organizationId, chatId, ...question },
			})
			const created = await tx.chatMessage.create({
				data: { organizationId, chatId, ...reply },
				select: { id: true },
			})
			await tx.chat.update({
				where: { id: chatId },
				data: { updatedAt: new Date() },
			})
			return { chatId, assistantMessageId: created.id, created: true }
		})
	} catch (error) {
		if (!isUniqueViolation(error)) throw error
		const raced = await existingExchange(session, input.idempotencyKey)
		if (raced) return raced
		throw inProgress
	}
}

export async function cancelReply(
	session: Session,
	chatId: string,
	messageId: string,
) {
	const result = await db().chatMessage.updateMany({
		where: {
			id: messageId,
			chatId,
			role: 'ASSISTANT',
			status: { in: ACTIVE_REPLY },
			chat: ownChats(session),
		},
		data: { status: 'CANCELLED', completedAt: new Date() },
	})
	return result.count > 0
}

/** "Coming soon" and clarifying replies don't decide how the next message is routed. */
function isFixedReply(value: Prisma.JsonValue) {
	const metadata = metadataOf(value)
	return metadata.unavailable === true || metadata.clarifying === true
}

export interface ReplyInputs {
	organization: ReplyOrganization
	question: string
	mode: ChatMode | null
	lastOperation: ChatMode | null
	history: HistoryTurn[]
}

export async function loadReplyInputs(
	session: Session,
	chatId: string,
	messageId: string,
): Promise<ReplyInputs> {
	const [organization, messages] = await Promise.all([
		db().organization.findUniqueOrThrow({
			where: { id: session.organization.id },
			select: {
				id: true,
				name: true,
				country: true,
				responseLanguage: true,
				requireCitations: true,
			},
		}),
		db().chatMessage.findMany({
			where: { chatId, chat: ownChats(session) },
			orderBy: { sequence: 'asc' },
			select: {
				id: true,
				role: true,
				content: true,
				status: true,
				operation: true,
				metadata: true,
			},
		}),
	])
	const index = messages.findIndex((message) => message.id === messageId)
	const question = messages[index - 1]
	if (index < 1 || question?.role !== 'USER') {
		throw new Error(`Reply ${messageId} has no question before it`)
	}
	const earlier = messages
		.slice(0, index - 1)
		.filter(
			(message) => message.status === 'COMPLETED' && message.role !== 'SYSTEM',
		)
	return {
		organization,
		question: question.content,
		mode: question.operation,
		lastOperation:
			earlier.findLast(
				(message) =>
					message.role === 'ASSISTANT' &&
					message.operation &&
					!isFixedReply(message.metadata),
			)?.operation ?? null,
		history: earlier.map(
			(message): HistoryTurn => ({
				role: message.role === 'USER' ? 'USER' : 'ASSISTANT',
				text: message.content,
			}),
		),
	}
}

export function markReplyStreaming(messageId: string) {
	return db().chatMessage.updateMany({
		where: { id: messageId, status: 'PENDING' },
		data: { status: 'STREAMING', heartbeatAt: new Date() },
	})
}

export function saveReplyProgress(
	messageId: string,
	text: string,
	label: string,
) {
	return db().chatMessage.updateMany({
		where: { id: messageId, status: { in: ACTIVE_REPLY } },
		data: {
			content: text,
			metadata: { status_label: label },
			heartbeatAt: new Date(),
		},
	})
}

export interface CompleteReplyInput extends ReplyOutcome {
	organizationId: string
	actorUserId: string
	chatId: string
	messageId: string
}

/** False when the reply was cancelled (or swept) first; nothing is written then. */
export function completeReply(input: CompleteReplyInput) {
	return db().$transaction(async (tx) => {
		const updated = await tx.chatMessage.updateMany({
			where: { id: input.messageId, status: { in: ACTIVE_REPLY } },
			data: {
				content: input.content,
				status: 'COMPLETED',
				operation: input.operation,
				metadata: input.metadata,
				completedAt: new Date(),
				heartbeatAt: new Date(),
			},
		})
		if (!updated.count) return false
		if (input.citations.length) {
			await tx.messageCitation.createMany({
				data: input.citations.map(({ order, passage }) => ({
					organizationId: input.organizationId,
					messageId: input.messageId,
					documentId: passage.documentId,
					documentVersionId: passage.versionId,
					chunkId: passage.chunkId,
					pageNumber: passage.pageStart,
					pageEnd: passage.pageEnd,
					sectionNumber: passage.sectionNumber,
					sectionTitle: passage.sectionTitle,
					quotedText: passage.content.slice(0, QUOTE_LENGTH),
					relevanceScore: Number(passage.score.toFixed(5)),
					citationOrder: order,
				})),
			})
		}
		await tx.chat.update({
			where: { id: input.chatId },
			data: { updatedAt: new Date() },
		})
		if (input.audit) {
			await tx.auditLog.create({
				data: {
					organizationId: input.organizationId,
					actorUserId: input.actorUserId,
					action: 'ai.question_answered',
					resourceType: 'chat',
					resourceId: input.chatId,
					metadata: { citations: input.citations.length },
				},
			})
		}
		return true
	})
}

export function failReply(messageId: string, code: string, text: string) {
	return db().chatMessage.updateMany({
		where: { id: messageId, status: { in: ACTIVE_REPLY } },
		data: {
			status: 'FAILED',
			errorCode: code,
			content: text,
			completedAt: new Date(),
		},
	})
}

/** Replies nobody has heart-beaten for 2 minutes died with their process (deploy, crash). */
export function sweepStalledReplies() {
	return db().$executeRaw`
		UPDATE chat_messages
		SET status = 'FAILED', error_code = 'STALLED', completed_at = now()
		WHERE status IN ('PENDING', 'STREAMING')
		  AND coalesce(heartbeat_at, created_at) < now() - interval '2 minutes'
	`
}
