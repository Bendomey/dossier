import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useInfinitePages } from '~/hooks/use-infinite-pages'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

export const useGetMembers = () =>
	useQuery({ queryKey: [QUERY_KEYS.MEMBERS], queryFn: api.listMembers })

function useInvalidateMembers() {
	const queryClient = useQueryClient()
	return () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MEMBERS] }),
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BILLING] }),
		])
}

export const useInviteMember = () => {
	const invalidate = useInvalidateMembers()
	return useMutation({
		mutationFn: (input: InviteMemberInput) => api.inviteMember(input),
		onSuccess: invalidate,
	})
}

export const useUpdateMember = () => {
	const invalidate = useInvalidateMembers()
	return useMutation({
		mutationFn: ({
			memberId,
			...input
		}: {
			memberId: string
			role?: Exclude<MemberRole, 'OWNER'>
			group_ids?: string[]
		}) => api.updateMember(memberId, input),
		onSuccess: invalidate,
	})
}

/** Settings, People: the loader's first page, then 50 more members per scroll. */
export const useGetPeoplePages = (
	first: PeopleOverview,
	organizationId: string,
) =>
	useInfinitePages({
		queryKey: [QUERY_KEYS.PEOPLE_PAGES, organizationId],
		first,
		url: (cursor) => `/api/people${cursor ? `?before=${cursor}` : ''}`,
	})
