import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
