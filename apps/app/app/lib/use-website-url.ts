import { useRouteLoaderData } from 'react-router'
import { WEBSITE_URL } from './constants'
import { crossAppUrl, type Utm } from './utm'

export const APP_UTM_SOURCE = 'dossier_app'

/** Link builder for the marketing website that carries the visitor's attribution. */
export function useWebsiteUrl() {
	const utm =
		(useRouteLoaderData('root') as { utm?: Utm } | undefined)?.utm ?? {}
	return (path: string, placement: string) =>
		crossAppUrl(WEBSITE_URL, path, { utm, source: APP_UTM_SOURCE, placement })
}
