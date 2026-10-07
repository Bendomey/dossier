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

type AuditCategory = 'DOCUMENTS' | 'AI' | 'MEMBERS'

interface AuditEvent {
	id: string
	time_label: string
	actor: string
	action: string
	target: string
	category: AuditCategory
}
