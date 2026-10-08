import { useQuery } from '@tanstack/react-query'
import { useInfinitePages } from '~/hooks/use-infinite-pages'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

export const useGetAuditEvents = (category?: AuditCategory) =>
	useQuery({
		queryKey: [QUERY_KEYS.AUDIT_EVENTS, category ?? 'ALL'],
		queryFn: () => api.listAuditEvents(category),
		placeholderData: (previous) => previous,
	})

/** Settings, Audit log: the loader's first page, then 50 older entries per scroll. */
export const useGetAuditPages = (
	first: AuditLogPage,
	organizationId: string,
	category: string | null,
) =>
	useInfinitePages({
		queryKey: [QUERY_KEYS.AUDIT_PAGES, organizationId, category ?? 'all'],
		first,
		url: (cursor) => {
			const params = new URLSearchParams()
			if (category) params.set('category', category)
			if (cursor) params.set('before', cursor)
			return `/api/audit-log${params.size ? `?${params}` : ''}`
		},
	})
