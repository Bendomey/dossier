interface BillingOverview {
	plan_label: string
	price_label: string
	renews_on: string
	seats: { used: number; limit: number }
	documents: { used: number; limit: number; storage_label: string }
	reviews: { used: number; limit: number; resets_on: string }
}

interface Invoice {
	id: string
	issued_on: string
	amount: string
	status: 'PAID'
}

type AuditCategory = 'DOCUMENTS' | 'AI' | 'MEMBERS' | 'WORKSPACE'

interface AuditEvent {
	id: string
	time_label: string
	actor: string
	action: string
	target: string
	category: AuditCategory
}

/** One audit log line, already worded for display (times in UTC, local time in Ghana and Liberia). */
interface AuditEntry {
	id: string
	occurred_at: string
	day_label: string
	time_label: string
	actor: string
	action: string
	target: string
	category: AuditCategory
}

interface AuditLogPage {
	entries: AuditEntry[]
	/** Pass back as `before` to load the next, older page; null on the last page. */
	next_cursor: string | null
}
