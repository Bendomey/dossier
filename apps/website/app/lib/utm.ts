export const UTM_KEYS = [
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_term',
	'utm_content',
] as const

export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>

export function readUtm(params: URLSearchParams): Utm {
	const utm: Utm = {}
	for (const key of UTM_KEYS) {
		const value = params.get(key)
		if (value) utm[key] = value.slice(0, 200)
	}
	return utm
}

/**
 * Builds a link into the other Dossier app. The campaign the visitor arrived
 * with (source, medium, campaign, term) passes through; anything missing is
 * filled in so every hop between apps is attributable. `utm_content` always
 * names the link that was clicked.
 */
export function crossAppUrl(
	baseUrl: string,
	path: string,
	{
		utm,
		source,
		placement,
		params,
	}: {
		utm: Utm
		source: string
		placement: string
		params?: Record<string, string>
	},
) {
	const url = new URL(path, baseUrl)
	for (const [key, value] of Object.entries(params ?? {}))
		url.searchParams.set(key, value)

	const merged: Utm = {
		utm_source: source,
		utm_medium: 'cross_app',
		utm_campaign: 'cross_app',
		...utm,
		utm_content: placement,
	}
	for (const key of UTM_KEYS) {
		const value = merged[key]
		if (value) url.searchParams.set(key, value)
	}
	return url.toString()
}
