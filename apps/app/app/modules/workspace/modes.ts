import {
	FilePenLine,
	GitCompare,
	MessageSquareText,
	ScanText,
	type LucideIcon,
} from 'lucide-react'

interface ModeDefinition {
	label: string
	short: string
	description: string
	icon: LucideIcon
	placeholder: string
	examples: string[]
}

export const MODES: Record<ChatMode, ModeDefinition> = {
	ASK: {
		label: 'Ask company knowledge',
		short: 'Ask',
		description: 'Answers with citations',
		icon: MessageSquareText,
		placeholder: 'Ask about your company’s documents…',
		examples: [
			'Can we terminate an employee immediately for breaching confidentiality?',
			'How many days of annual leave do new hires get?',
			'Who can sign contracts above GHS 100,000?',
		],
	},
	DRAFT: {
		label: 'Draft a document',
		short: 'Draft',
		description: 'From approved templates',
		icon: FilePenLine,
		placeholder: 'Describe the document you need…',
		examples: [
			'Draft an employment agreement for Kwame Mensah, Senior Software Engineer, starting 1 November',
			'Write a supplier NDA for Abidjan Logistique in French',
			'Create a board resolution approving the 2027 budget',
		],
	},
	REVIEW: {
		label: 'Review or proofread',
		short: 'Review',
		description: 'Risky clauses and errors',
		icon: ScanText,
		placeholder: 'Attach a file or name a document to review…',
		examples: [
			'Review the Acme supply agreement against our standards',
			'Proofread the Leave and Benefits Policy',
			'Find risky clauses in Partnership Agreement v3',
		],
	},
	COMPARE: {
		label: 'Compare documents',
		short: 'Compare',
		description: 'See what changed',
		icon: GitCompare,
		placeholder: 'Name the two documents to compare…',
		examples: [
			'Compare Partnership Agreement v2 and v3',
			'What changed between the 2025 and 2026 Employee Handbook?',
			'Compare the Acme agreement with our vendor template',
		],
	},
}

export const MODE_KEYS = Object.keys(MODES) as ChatMode[]

export function isChatMode(value: unknown): value is ChatMode {
	return typeof value === 'string' && value in MODES
}
