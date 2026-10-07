import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

const key = [QUERY_KEYS.ORGANIZATION]

export const useGetOrganization = () =>
	useQuery({ queryKey: key, queryFn: api.getOrganization })

export const useUpdateOrganization = () => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: UpdateOrganizationInput) =>
			api.updateOrganization(input),
		onMutate: async (input) => {
			await queryClient.cancelQueries({ queryKey: key })
			const previous = queryClient.getQueryData<Organization>(key)
			queryClient.setQueryData<Organization>(
				key,
				(current) => current && { ...current, ...input },
			)
			return { previous }
		},
		onError: (_error, _input, context) =>
			queryClient.setQueryData(key, context?.previous),
		onSuccess: (organization) => queryClient.setQueryData(key, organization),
	})
}
