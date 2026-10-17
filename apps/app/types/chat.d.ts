type ChatMode = 'ASK' | 'DRAFT' | 'REVIEW' | 'COMPARE'

interface ChatSource {
	key: string
	title: string
}

interface ReviewFinding {
	severity: 'HIGH' | 'MEDIUM' | 'LOW'
	clause: string
	text: string
	source: string
}

interface DocumentChange {
	removed: string
	added: string
	note: string
}

interface DraftAttachment {
	title: string
	meta: string
}

/** A validated source of an answer. Unavailable once the person can no longer read the document. */
interface Citation {
	order: number
	document_id: string
	document_name: string | null
	version_id: string
	version_number: number | null
	page: number | null
	page_end: number | null
	section: string | null
	available: boolean
}

interface ChatMessage {
	id: string
	role: 'USER' | 'ASSISTANT'
	text: string
	/** Assistant messages only. */
	status?: 'PENDING' | 'STREAMING' | 'DONE' | 'FAILED' | 'CANCELLED'
	status_label?: string
	sources?: ChatSource[]
	citations?: Citation[]
	error?: { code: string; retryable: boolean }
	/** The organization requires citations and this answer has none. */
	unsupported?: boolean
	clarifying?: boolean
	findings?: ReviewFinding[]
	changes?: DocumentChange[]
	draft?: DraftAttachment
}

interface Chat {
	id: string
	title: string
	created_at: string
	messages: ChatMessage[]
}

type ChatSummary = Pick<Chat, 'id' | 'title' | 'created_at'>

interface ChatPage {
	chats: ChatSummary[]
	next_cursor: string | null
}

interface NewChatInput {
	prompt: string
	mode: ChatMode | null
	collectionId: string | null
}

interface NewMessageInput {
	prompt: string
	mode: ChatMode | null
}

interface ChatCollectionOption {
	id: string
	name: string
}

/** Events emitted while an assistant reply streams in. */
type ChatStreamEvent =
	| { type: 'status'; label: string }
	| { type: 'snapshot'; text: string; label: string }
	| { type: 'delta'; text: string }
	| { type: 'citations'; citations: Citation[] }
	| {
			type: 'attachments'
			sources?: ChatSource[]
			findings?: ReviewFinding[]
			changes?: DocumentChange[]
			draft?: DraftAttachment
	  }
	| { type: 'error'; code: string; retryable: boolean }
	| { type: 'done'; unsupported?: boolean; clarifying?: boolean }
