export const NODE_ENV = process.env.NODE_ENV
export const APP_NAME = 'Justo'
/** Temporary Fly.io hosts until the justo domain is secured. */
export const WEBSITE_URL = 'https://justo.fly.dev'
export const APP_URL = 'https://justo-africa.fly.dev'

export const QUERY_KEYS = {
	GROUPS: 'groups',
	COLLECTIONS: 'collections',
	DOCUMENTS: 'documents',
	DOCUMENT_VERSIONS: 'document-versions',
	KNOWLEDGE_STATS: 'knowledge-stats',
	MEMBERS: 'members',
	CHATS: 'chats',
	BILLING: 'billing',
	INVOICES: 'invoices',
	AUDIT_EVENTS: 'audit-events',
	PEOPLE_PAGES: 'people-pages',
	GROUP_PAGES: 'group-pages',
	AUDIT_PAGES: 'audit-pages',
} as const
