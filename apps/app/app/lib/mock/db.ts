/**
 * In-browser stand-in for the Dossier API until the backend exists. Every
 * function mirrors an endpoint the `~/api` modules will call, returns copies
 * (so cached query data is never mutated in place) and resolves after a
 * realistic delay. State resets on reload.
 */
import { pickReply } from './responses'
import {
	AUDIT_EVENTS,
	COLLECTIONS,
	DOCUMENTS,
	GROUPS,
	INVOICES,
	MEMBERS,
	ORGANIZATION,
	RECENT_CHAT_TITLES,
	UNLISTED_DOCUMENT_COUNT,
} from './seed'

const PROCESSING_STEP = 7
const PROCESSING_INTERVAL_MS = 600

interface StoredMessage extends ChatMessage {
	prompt?: string
	mode?: ChatMode | null
}

interface StoredChat extends Omit<Chat, 'messages'> {
	messages: StoredMessage[]
}

const state = {
	organization: structuredClone(ORGANIZATION),
	groups: structuredClone(GROUPS),
	collections: structuredClone(COLLECTIONS),
	documents: DOCUMENTS.map((document) => ({
		...structuredClone(document),
		processedAt: Date.now(),
	})),
	members: structuredClone(MEMBERS),
	chats: RECENT_CHAT_TITLES.map<StoredChat>((title, index) => {
		const reply = pickReply(title, null)
		return {
			id: `chat_seed_${index}`,
			title,
			created_at: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(),
			messages: [
				{ id: `msg_seed_${index}_q`, role: 'USER', text: title },
				{
					id: `msg_seed_${index}_a`,
					role: 'ASSISTANT',
					status: 'DONE',
					text: reply.text,
					status_label: reply.status,
					sources: reply.sources,
					findings: reply.findings,
					changes: reply.changes,
					draft: reply.draft,
				},
			],
		}
	}),
}

let sequence = 0
const id = (prefix: string) =>
	`${prefix}_${Date.now().toString(36)}${(sequence++).toString(36)}`

export function delay(ms = 250 + Math.random() * 250) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

const copy = <T>(value: T): T => structuredClone(value)

function notFound(entity: string): never {
	throw new Error(`${entity} not found`)
}

/* Organization */

export async function getOrganization() {
	await delay()
	return copy(state.organization)
}

export async function updateOrganization(input: UpdateOrganizationInput) {
	await delay()
	Object.assign(state.organization, input)
	return copy(state.organization)
}

/* Groups and collections */

export async function listGroups() {
	await delay()
	return copy(state.groups)
}

export async function createGroup(name: string) {
	await delay()
	const group: Group = { id: id('grp'), name, is_builtin: false }
	state.groups.push(group)
	return copy(group)
}

export async function renameGroup(groupId: string, name: string) {
	await delay(150)
	const group =
		state.groups.find((item) => item.id === groupId) ?? notFound('Group')
	if (group.is_builtin) throw new Error('Built-in groups cannot be renamed')
	group.name = name
	return copy(group)
}

export async function deleteGroup(groupId: string) {
	await delay()
	const without = (ids: string[]) => ids.filter((item) => item !== groupId)
	state.groups = state.groups.filter(
		(group) => group.id !== groupId || group.is_builtin,
	)
	state.members.forEach(
		(member) => (member.group_ids = without(member.group_ids)),
	)
	state.collections.forEach(
		(collection) => (collection.group_ids = without(collection.group_ids)),
	)
	state.documents.forEach((document) => {
		if (document.group_ids) document.group_ids = without(document.group_ids)
	})
}

export async function listCollections() {
	await delay()
	return copy(state.collections)
}

export async function setCollectionGroups(
	collectionId: string,
	groupIds: string[],
) {
	await delay(150)
	const collection =
		state.collections.find((item) => item.id === collectionId) ??
		notFound('Collection')
	collection.group_ids = [...groupIds]
	return copy(collection)
}

/* Documents */

function advanceProcessing() {
	const now = Date.now()
	for (const document of state.documents) {
		if (document.status !== 'PROCESSING') continue
		const steps = Math.floor(
			(now - document.processedAt) / PROCESSING_INTERVAL_MS,
		)
		if (steps < 1) continue
		document.processedAt += steps * PROCESSING_INTERVAL_MS
		document.progress = Math.min(
			100,
			document.progress + steps * PROCESSING_STEP,
		)
		if (document.progress >= 100) {
			document.status = 'READY'
			document.updated_at = new Date().toISOString()
		}
	}
}

const toDocument = ({
	processedAt: _,
	...document
}: (typeof state.documents)[number]) => copy(document) as DossierDocument

export async function listDocuments(filter: FetchDocumentsFilter = {}) {
	await delay()
	advanceProcessing()
	const query = filter.query?.trim().toLowerCase()
	return state.documents
		.filter(
			(document) =>
				(!filter.collection_id ||
					document.collection_id === filter.collection_id) &&
				(!filter.templates_only || document.is_template) &&
				(!query || document.name.toLowerCase().includes(query)),
		)
		.map(toDocument)
}

export async function getDocument(documentId: string) {
	await delay(200)
	advanceProcessing()
	const document =
		state.documents.find((item) => item.id === documentId) ??
		notFound('Document')
	return toDocument(document)
}

export async function getDocumentVersions(documentId: string) {
	await delay(200)
	const document =
		state.documents.find((item) => item.id === documentId) ??
		notFound('Document')
	const versions: DocumentVersion[] = [
		{
			id: `${documentId}_v3`,
			label:
				document.status === 'PROCESSING'
					? 'Current, indexing'
					: 'Current version',
			note: `Uploaded by ${document.uploaded_by}`,
			created_at: document.updated_at,
			is_current: true,
		},
		{
			id: `${documentId}_v2`,
			label: 'Previous version',
			note: 'Replaced, still searchable for history',
			created_at: '2026-03-12T10:00:00Z',
			is_current: false,
		},
		{
			id: `${documentId}_v1`,
			label: 'First upload',
			note: `Uploaded by ${document.uploaded_by}`,
			created_at: '2025-11-03T10:00:00Z',
			is_current: false,
		},
	]
	return versions
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
	await delay()
	advanceProcessing()
	const processing = state.documents.filter(
		(document) => document.status === 'PROCESSING',
	).length
	const total = UNLISTED_DOCUMENT_COUNT + state.documents.length
	return { total, processing, ready: total - processing, templates: 14 }
}

export async function setDocumentAccess(
	documentId: string,
	groupIds: string[] | null,
) {
	await delay(150)
	const document =
		state.documents.find((item) => item.id === documentId) ??
		notFound('Document')
	document.group_ids = groupIds ? [...groupIds] : null
	return toDocument(document)
}

export async function uploadDocument(
	input: UploadDocumentInput,
	uploadedBy: string,
) {
	await delay(600)
	const extension = input.file_name.split('.').pop()?.toUpperCase()
	const document = {
		id: id('doc'),
		name: input.file_name.replace(/\.[^.]+$/, ''),
		file_type: (extension === 'DOCX' ? 'DOCX' : 'PDF') as DocumentFileType,
		collection_id: input.collection_id,
		language: 'EN' as const,
		status: 'PROCESSING' as const,
		progress: 4,
		is_template: false,
		pages: Math.max(1, Math.round(input.size / 60_000)),
		uploaded_by: uploadedBy,
		answer_count: 0,
		updated_at: new Date().toISOString(),
		group_ids: input.group_ids,
		processedAt: Date.now(),
	}
	state.documents.unshift(document)
	return toDocument(document)
}

export async function removeDocument(documentId: string) {
	await delay()
	state.documents = state.documents.filter(
		(document) => document.id !== documentId,
	)
}

/* Members */

export async function listMembers() {
	await delay()
	return copy(state.members)
}

export async function inviteMember(input: InviteMemberInput) {
	await delay()
	const email = input.email.trim().toLowerCase()
	if (state.members.some((member) => member.email === email)) {
		throw new Error(`${email} is already in this workspace`)
	}
	if (state.members.length >= state.organization.plan.seats) {
		throw new Error('Every seat on your plan is in use')
	}
	const member: Member = {
		id: id('mem'),
		name: email.split('@')[0] ?? email,
		email,
		role: input.role,
		group_ids: input.role === 'MEMBER' ? [...input.group_ids] : [],
		invited: true,
	}
	state.members.push(member)
	return copy(member)
}

export async function updateMember(
	memberId: string,
	input: { role?: Exclude<MemberRole, 'OWNER'>; group_ids?: string[] },
) {
	await delay(150)
	const member =
		state.members.find((item) => item.id === memberId) ?? notFound('Member')
	if (member.role === 'OWNER')
		throw new Error('The owner’s role cannot be changed')
	Object.assign(member, input)
	return copy(member)
}

/* Chats */

const toChat = (chat: StoredChat): Chat => ({
	...copy(chat),
	messages: chat.messages.map(({ prompt: _, mode: __, ...message }) =>
		copy(message),
	),
})

export async function listChats(): Promise<ChatSummary[]> {
	await delay(200)
	return state.chats
		.toSorted((a, b) => b.created_at.localeCompare(a.created_at))
		.map(({ id, title, created_at }) => ({ id, title, created_at }))
}

export async function getChat(chatId: string) {
	await delay(200)
	return toChat(
		state.chats.find((chat) => chat.id === chatId) ?? notFound('Chat'),
	)
}

function addExchange(chat: StoredChat, prompt: string, mode: ChatMode | null) {
	chat.messages.push(
		{ id: id('msg'), role: 'USER', text: prompt },
		{
			id: id('msg'),
			role: 'ASSISTANT',
			text: '',
			status: 'PENDING',
			prompt,
			mode,
		},
	)
}

export async function createChat(prompt: string, mode: ChatMode | null) {
	await delay(200)
	const chat: StoredChat = {
		id: id('chat'),
		title: prompt.slice(0, 60),
		created_at: new Date().toISOString(),
		messages: [],
	}
	addExchange(chat, prompt, mode)
	state.chats.push(chat)
	return toChat(chat)
}

export async function sendMessage(
	chatId: string,
	prompt: string,
	mode: ChatMode | null,
) {
	await delay(150)
	const chat =
		state.chats.find((item) => item.id === chatId) ?? notFound('Chat')
	addExchange(chat, prompt, mode)
	return toChat(chat)
}

type StreamListener = (event: ChatStreamEvent) => void

/** Replies being generated, keyed by message id, with whoever is listening. */
const generations = new Map<string, Set<StreamListener>>()

function generate(message: StoredMessage) {
	const listeners = new Set<StreamListener>()
	generations.set(message.id, listeners)
	const emit = (event: ChatStreamEvent) =>
		listeners.forEach((listener) => listener(event))
	const reply = pickReply(message.prompt ?? '', message.mode ?? null)

	void (async () => {
		message.status = 'STREAMING'
		message.status_label = reply.status
		emit({ type: 'status', label: reply.status })
		await delay(1100)

		for (let index = 0; index < reply.text.length; index += 6) {
			const text = reply.text.slice(index, index + 6)
			message.text += text
			emit({ type: 'delta', text })
			await delay(28)
		}

		Object.assign(message, {
			status: 'DONE',
			sources: reply.sources,
			findings: reply.findings,
			changes: reply.changes,
			draft: reply.draft,
		})
		emit({
			type: 'attachments',
			sources: reply.sources,
			findings: reply.findings,
			changes: reply.changes,
			draft: reply.draft,
		})
		emit({ type: 'done' })
		generations.delete(message.id)
	})()

	return listeners
}

/**
 * Streams the chat's unfinished assistant reply, the way the API will over
 * server-sent events. Generation runs once per message no matter how many
 * listeners come and go; a listener that joins late first receives a
 * snapshot of everything written so far. Aborting only stops listening.
 */
export function streamReply(
	chatId: string,
	onEvent: StreamListener,
	signal?: AbortSignal,
) {
	const chat =
		state.chats.find((item) => item.id === chatId) ?? notFound('Chat')
	const message = chat.messages.findLast(
		(item) => item.role === 'ASSISTANT' && item.status !== 'DONE',
	)
	if (!message) return

	const listeners = generations.get(message.id) ?? generate(message)
	if (message.status === 'STREAMING') {
		onEvent({
			type: 'snapshot',
			text: message.text,
			label: message.status_label ?? '',
		})
	}
	listeners.add(onEvent)
	signal?.addEventListener('abort', () => listeners.delete(onEvent), {
		once: true,
	})
}

/* Billing and audit */

export async function getBillingOverview(): Promise<BillingOverview> {
	await delay()
	const documents = UNLISTED_DOCUMENT_COUNT + state.documents.length
	return {
		plan_label: 'Team, billed yearly',
		price_label: `$12 per user a month · ${state.members.length} seats · Renews 1 November 2026`,
		renews_on: '2026-11-01',
		seats: { used: state.members.length, limit: state.organization.plan.seats },
		documents: { used: documents, limit: 2000, storage_label: '1.2 GB stored' },
		reviews: { used: 31, limit: 50, resets_on: '2026-11-01' },
	}
}

export async function listInvoices() {
	await delay()
	return copy(INVOICES)
}

export async function listAuditEvents(category?: AuditCategory) {
	await delay()
	return copy(
		category
			? AUDIT_EVENTS.filter((event) => event.category === category)
			: AUDIT_EVENTS,
	)
}
