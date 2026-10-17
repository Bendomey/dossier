import type { Passage } from '../sources.server'

export interface HistoryTurn {
	role: 'USER' | 'ASSISTANT'
	text: string
}

export interface ReplyOrganization {
	id: string
	name: string
	country: 'GH' | 'LR'
	responseLanguage: ResponseLanguage
	requireCitations: boolean
}

export interface CitedPassage {
	order: number
	passage: Passage
}

export interface ReplyOutcome {
	content: string
	operation: ChatMode
	metadata: Record<string, string | number | boolean>
	citations: CitedPassage[]
	/** Records ai.question_answered; fixed replies (coming soon, clarifying) don't. */
	audit: boolean
}

export interface ReplyIO {
	status(label: string): void
	delta(text: string): void
	signal: AbortSignal
}
