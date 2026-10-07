import { useQuery } from '@tanstack/react-query'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

export const useGetBillingOverview = () =>
	useQuery({ queryKey: [QUERY_KEYS.BILLING], queryFn: api.getBillingOverview })

export const useGetInvoices = () =>
	useQuery({ queryKey: [QUERY_KEYS.INVOICES], queryFn: api.listInvoices })
