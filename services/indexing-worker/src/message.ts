export interface IndexRequestedMessage {
	event_id: string
	organization_id: string
	document_id: string
	document_version_id: string
	indexing_job_id: string
}

const FIELDS = [
	'event_id',
	'organization_id',
	'document_id',
	'document_version_id',
	'indexing_job_id',
] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseMessage(body: unknown): IndexRequestedMessage | null {
	if (typeof body !== 'object' || body === null) return null
	const record = body as Record<string, unknown>
	const message: Partial<IndexRequestedMessage> = {}
	for (const field of FIELDS) {
		const value = record[field]
		if (typeof value !== 'string' || !UUID.test(value)) return null
		message[field] = value
	}
	return message as IndexRequestedMessage
}

export function log(event: string, fields: Record<string, unknown> = {}) {
	console.log(JSON.stringify({ event, ...fields }))
}
