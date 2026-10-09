import type { Prisma } from '~/generated/prisma/client'
import { db } from '~/lib/db.server'

const PAGE_SIZE = 50
const EXPORT_LIMIT = 10_000

const CATEGORY_PREFIXES: Record<AuditCategory, string[]> = {
	DOCUMENTS: ['document.', 'collection.', 'template.'],
	AI: ['ai.'],
	MEMBERS: ['member.', 'role.', 'group.'],
	WORKSPACE: ['organization.'],
}

const SETTING_LABELS: Record<string, string> = {
	name: 'name',
	country: 'country',
	response_language: 'AI response language',
	require_citations: 'citations',
	members_can_upload: 'member uploads',
	detect_document_language: 'document language detection',
}

export function isAuditCategory(value: unknown): value is AuditCategory {
	return typeof value === 'string' && value in CATEGORY_PREFIXES
}

const categoryOf = (action: string): AuditCategory =>
	(Object.entries(CATEGORY_PREFIXES).find(([, prefixes]) =>
		prefixes.some((prefix) => action.startsWith(prefix)),
	)?.[0] as AuditCategory | undefined) ?? 'WORKSPACE'

const text = (value: unknown) => (typeof value === 'string' ? value : '')
const lower = (value: unknown) => text(value).toLowerCase()

/** Turns a stored event into "verb" + "target", e.g. "invited" + "esi@asante.co as member". */
export function describeAuditEvent(
	action: string,
	metadata: Record<string, unknown>,
): { action: string; target: string } {
	const m = metadata
	const person = text(m.person) || text(m.email)
	switch (action) {
		case 'organization.created':
			return { action: 'created the workspace', target: text(m.name) }
		case 'organization.updated': {
			const fields = Object.keys((m.changes as object | undefined) ?? {})
				.map((key) => SETTING_LABELS[key] ?? key.replaceAll('_', ' '))
				.join(', ')
			return {
				action: 'updated',
				target: fields
					? `workspace settings (${fields})`
					: 'workspace settings',
			}
		}
		case 'member.invited':
			return {
				action: 'invited',
				target: m.role ? `${text(m.email)} as ${lower(m.role)}` : text(m.email),
			}
		case 'member.joined':
			return { action: 'joined the workspace', target: '' }
		case 'member.removed':
			return { action: 'removed', target: person }
		case 'member.invitation_revoked':
			return { action: 'revoked the invitation for', target: text(m.email) }
		case 'member.invitation_resent':
			return { action: 'resent the invitation to', target: text(m.email) }
		case 'member.invitation_declined':
			return { action: 'declined an invitation', target: '' }
		case 'member.groups_changed':
			return { action: 'changed the groups of', target: person }
		case 'role.assigned':
			return {
				action: 'changed the role of',
				target: m.to ? `${person} to ${lower(m.to)}` : text(m.target),
			}
		case 'group.created':
			return { action: 'created the group', target: text(m.name) }
		case 'group.renamed':
			return {
				action: 'renamed the group',
				target: `${text(m.from)} to ${text(m.to)}`,
			}
		case 'group.deleted':
			return { action: 'deleted the group', target: text(m.name) }
		case 'group.member_added':
			return { action: 'added', target: `${person} to ${text(m.group)}` }
		case 'group.member_removed':
			return { action: 'removed', target: `${person} from ${text(m.group)}` }
		case 'collection.created':
			return { action: 'created the collection', target: text(m.name) }
		case 'collection.updated': {
			const access = Array.isArray(m.groups)
				? (m.groups as unknown[]).map(text).join(', ') || 'only admins'
				: null
			if (m.from) {
				return {
					action: 'renamed the collection',
					target: `${text(m.from)} to ${text(m.name)}${access ? ` and shared it with ${access}` : ''}`,
				}
			}
			return access
				? {
						action: 'changed who can see',
						target: `${text(m.name)} to ${access}`,
					}
				: { action: 'edited the collection', target: text(m.name) }
		}
		case 'collection.deleted':
			return { action: 'deleted the collection', target: text(m.name) }
		case 'collection.access_changed':
			return m.access === 'none'
				? {
						action: 'removed',
						target: `${text(m.group)}’s access to ${text(m.collection)}`,
					}
				: {
						action: 'gave',
						target: `${text(m.group)} access to ${text(m.collection)}`,
					}
		case 'document.uploaded':
			return { action: 'uploaded', target: text(m.target) }
		case 'document.permission_changed':
			return { action: 'changed access on', target: text(m.target) }
		case 'ai.contract_reviewed':
			return { action: 'reviewed', target: text(m.target) }
		case 'ai.document_generated':
			return { action: 'drafted', target: text(m.target) }
		default:
			return {
				action: action.split('.').pop()!.replaceAll('_', ' '),
				target: text(m.target),
			}
	}
}

const dayFormat = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC',
})
const timeFormat = new Intl.DateTimeFormat('en-GB', {
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'UTC',
})

function dayLabel(date: Date, now = new Date()) {
	const day = (value: Date) => value.toISOString().slice(0, 10)
	if (day(date) === day(now)) return 'Today'
	if (day(date) === day(new Date(now.getTime() - 86_400_000)))
		return 'Yesterday'
	return dayFormat.format(date)
}

type AuditRow = Prisma.AuditLogGetPayload<{ include: { actor: true } }>

function toEntry(row: AuditRow): AuditEntry {
	const metadata =
		row.metadata &&
		typeof row.metadata === 'object' &&
		!Array.isArray(row.metadata)
			? (row.metadata as Record<string, unknown>)
			: {}
	return {
		id: row.id,
		occurred_at: row.createdAt.toISOString(),
		day_label: dayLabel(row.createdAt),
		time_label: timeFormat.format(row.createdAt),
		actor:
			row.actor?.displayName ??
			row.actor?.email ??
			(row.actorUserId ? 'A former member' : 'Dossier'),
		...describeAuditEvent(row.action, metadata),
		category: categoryOf(row.action),
	}
}

const whereFor = (
	organizationId: string,
	category?: AuditCategory,
): Prisma.AuditLogWhereInput => ({
	organizationId,
	...(category
		? {
				OR: CATEGORY_PREFIXES[category].map((prefix) => ({
					action: { startsWith: prefix },
				})),
			}
		: {}),
})

const NEWEST_FIRST: Prisma.AuditLogOrderByWithRelationInput[] = [
	{ createdAt: 'desc' },
	{ id: 'desc' },
]

/** One page of the organization's audit log, newest first. */
export async function listAuditEntries(
	organizationId: string,
	options: { category?: AuditCategory; before?: string | null } = {},
): Promise<AuditLogPage> {
	const rows = await db().auditLog.findMany({
		where: whereFor(organizationId, options.category),
		orderBy: NEWEST_FIRST,
		include: { actor: true },
		take: PAGE_SIZE + 1,
		...(options.before ? { cursor: { id: options.before }, skip: 1 } : {}),
	})
	const page = rows.slice(0, PAGE_SIZE)
	return {
		entries: page.map(toEntry),
		next_cursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null,
	}
}

/** The whole log (up to 10,000 entries) as CSV, with UTC timestamps and the raw event name. */
export async function exportAuditCsv(
	organizationId: string,
	category?: AuditCategory,
) {
	const rows = await db().auditLog.findMany({
		where: whereFor(organizationId, category),
		orderBy: NEWEST_FIRST,
		include: { actor: true },
		take: EXPORT_LIMIT,
	})
	const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
	const lines = [
		['Time (UTC)', 'Person', 'Email', 'Action', 'Target', 'Category', 'Event'],
		...rows.map((row) => {
			const entry = toEntry(row)
			return [
				entry.occurred_at,
				entry.actor,
				row.actor?.email ?? '',
				entry.action,
				entry.target,
				entry.category,
				row.action,
			]
		}),
	]
	return lines.map((line) => line.map(escape).join(',')).join('\n')
}
