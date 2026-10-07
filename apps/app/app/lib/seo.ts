import { APP_NAME, APP_URL } from './constants'

const DESCRIPTION =
	'Answers, reviews and drafts from your own company documents. Every answer is cited.'
const OG_IMAGE = `${APP_URL}/images/og-image.png`

/** Page title plus share-card tags. App pages are private, so they are never indexed. */
export function pageTitle(title?: string) {
	const fullTitle = title ? `${title} · ${APP_NAME}` : APP_NAME
	return [
		{ title: fullTitle },
		{ name: 'description', content: DESCRIPTION },
		{ name: 'robots', content: 'noindex, nofollow' },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:site_name', content: APP_NAME },
		{ property: 'og:title', content: fullTitle },
		{ property: 'og:description', content: DESCRIPTION },
		{ property: 'og:image', content: OG_IMAGE },
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ property: 'og:image:type', content: 'image/png' },
		{
			property: 'og:image:alt',
			content: 'Dossier: answers, reviews and drafts from your own documents',
		},
		{ name: 'twitter:card', content: 'summary_large_image' },
		{ name: 'twitter:title', content: fullTitle },
		{ name: 'twitter:description', content: DESCRIPTION },
		{ name: 'twitter:image', content: OG_IMAGE },
	]
}
