import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

export const useGetCollections = () =>
	useQuery({ queryKey: [QUERY_KEYS.COLLECTIONS], queryFn: api.listCollections })

export const useSetCollectionGroups = () => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({
			collectionId,
			groupIds,
		}: {
			collectionId: string
			groupIds: string[]
		}) => api.setCollectionGroups(collectionId, groupIds),
		onSuccess: () =>
			Promise.all([
				queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.COLLECTIONS] }),
				queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.DOCUMENTS] }),
			]),
	})
}
