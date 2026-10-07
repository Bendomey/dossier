import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

export const useGetAuditEvents = (category?: AuditCategory) =>
	useQuery({
		queryKey: [QUERY_KEYS.AUDIT_EVENTS, category ?? 'ALL'],
		queryFn: () => api.listAuditEvents(category),
		placeholderData: (previous) => previous,
	})
