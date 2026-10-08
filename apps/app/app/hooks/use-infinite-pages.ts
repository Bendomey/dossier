import {
	type InfiniteData,
	useInfiniteQuery,
	useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { transport } from '~/lib/transport'
import { useAppBase } from '~/providers/app-base-provider'

interface Page {
	next_cursor: string | null
}

/**
 * A list whose first page comes from the route loader and whose later pages
 * are fetched in the browser as the reader scrolls. When the loader returns a
 * new first page (React Router revalidates after every action), the loaded
 * pages are refreshed too, so edits further down the list stay current.
 */
export function useInfinitePages<P extends Page>({
	queryKey,
	first,
	url,
}: {
	queryKey: readonly unknown[]
	first: P
	/** The JSON endpoint for the page after `cursor` (the first page when null). */
	url: (cursor: string | null) => string
}) {
	const queryClient = useQueryClient()
	const { demo } = useAppBase()
	const query = useInfiniteQuery({
		queryKey,
		queryFn: async ({ pageParam }) =>
			(await (await transport(url(pageParam))).json()) as P,
		initialPageParam: null as string | null,
		getNextPageParam: (last) => last.next_cursor,
		initialData: { pages: [first], pageParams: [null] },
		staleTime: Infinity,
		// Dropped when the page unmounts, so coming back starts from the loader's fresh page.
		gcTime: 0,
		enabled: !demo,
	})

	const seen = useRef({ key: JSON.stringify(queryKey), first })
	useEffect(() => {
		const key = JSON.stringify(queryKey)
		if (seen.current.key !== key || seen.current.first === first) {
			seen.current = { key, first }
			return
		}
		seen.current = { key, first }
		const loaded = queryClient.getQueryData<InfiniteData<P>>(queryKey)
		if (!loaded || loaded.pages.length <= 1) {
			queryClient.setQueryData<InfiniteData<P>>(queryKey, {
				pages: [first],
				pageParams: [null],
			})
		} else {
			void queryClient.invalidateQueries({ queryKey })
		}
	}, [first, queryKey, queryClient])

	return query
}
