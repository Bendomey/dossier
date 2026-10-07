import { useRouteLoaderData } from 'react-router'
import { APP_URL } from './constants'
import { crossAppUrl, type Utm } from './utm'

export const WEBSITE_UTM_SOURCE = 'dossier_website'

/** Link builder for the Dossier app that carries the visitor's attribution. */
export function useAppUrl() {
	const utm =
		(useRouteLoaderData('root') as { utm?: Utm } | undefined)?.utm ?? {}
	return (path: string, placement: string) =>
		crossAppUrl(APP_URL, path, { utm, source: WEBSITE_UTM_SOURCE, placement })
}
