import { useMatches } from 'react-router'

export interface RouteHandle {
	title?: string
}

/** The title of the deepest route that declares one in its `handle`. */
export function usePageTitle() {
	const matches = useMatches()
	return matches
		.map((match) => (match.handle as RouteHandle | undefined)?.title)
		.filter(Boolean)
		.at(-1)
}
