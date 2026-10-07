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

interface ChatMessage {
	id: string
	role: 'USER' | 'ASSISTANT'
	text: string
	/** Assistant messages only. */
	status?: 'PENDING' | 'STREAMING' | 'DONE'
	status_label?: string
	sources?: ChatSource[]
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

/** Events emitted while an assistant reply streams in. */
type ChatStreamEvent =
	| { type: 'status'; label: string }
	| { type: 'snapshot'; text: string; label: string }
	| { type: 'delta'; text: string }
	| {
			type: 'attachments'
			sources?: ChatSource[]
			findings?: ReviewFinding[]
			changes?: DocumentChange[]
			draft?: DraftAttachment
	  }
	| { type: 'done' }
