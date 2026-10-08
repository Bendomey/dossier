import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useInfinitePages } from '~/hooks/use-infinite-pages'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

export const useGetGroups = () =>
	useQuery({ queryKey: [QUERY_KEYS.GROUPS], queryFn: api.listGroups })

function useInvalidateAccess() {
	const queryClient = useQueryClient()
	return () =>
		Promise.all(
			[
				QUERY_KEYS.GROUPS,
				QUERY_KEYS.MEMBERS,
				QUERY_KEYS.COLLECTIONS,
				QUERY_KEYS.DOCUMENTS,
			].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
		)
}

export const useCreateGroup = () => {
	const invalidate = useInvalidateAccess()
	return useMutation({
		mutationFn: (name: string) => api.createGroup(name),
		onSuccess: invalidate,
	})
}

export const useRenameGroup = () => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
			api.renameGroup(groupId, name),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.GROUPS] }),
	})
}

export const useDeleteGroup = () => {
	const invalidate = useInvalidateAccess()
	return useMutation({
		mutationFn: (groupId: string) => api.deleteGroup(groupId),
		onSuccess: invalidate,
	})
}

/** Settings, Groups: the loader's first page, then 50 more groups per scroll. */
export const useGetGroupPages = (
	first: GroupsOverview,
	organizationId: string,
) =>
	useInfinitePages({
		queryKey: [QUERY_KEYS.GROUP_PAGES, organizationId],
		first,
		url: (cursor) => `/api/groups${cursor ? `?before=${cursor}` : ''}`,
	})
