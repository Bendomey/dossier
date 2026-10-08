export const NODE_ENV = process.env.NODE_ENV
export const APP_NAME = 'Dossier'
/** Temporary Fly.io hosts until the dossier domain is secured. */
export const WEBSITE_URL = 'https://dossier.fly.dev'
export const APP_URL = 'https://dossier-africa.fly.dev'

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
