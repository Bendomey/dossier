import { APP_NAME } from './constants'
import { capitalize } from './utils'

const MAX_LENGTH_META_DESCRIPTION = 200

const coreKeywords: string[] = []

export const pageKeywords = {
	home: [] as string[],
}

const baseKeywords = coreKeywords.join(', ')

export function getSocialMetas({
	url,
	title = capitalize(APP_NAME),
	description = '',
	images = [],
	keywords = '',
	origin,
}: {
	images?: Array<string>
	url: string
	title?: string
	description?: string
	keywords?: string | string[]
	origin?: string
}) {
	const pageTerms = Array.isArray(keywords) ? keywords.join(', ') : keywords
	const allKeywords = [APP_NAME, pageTerms, baseKeywords]
		.filter(Boolean)
		.join(', ')

	if (!images.length && origin) {
		images = [`${origin}/images/og-image.png`]
	}

	const ogImages = images.flatMap((image) => [
		{ property: 'og:image', content: image },
		{ property: 'og:image:width', content: '1200' },
		{ property: 'og:image:height', content: '630' },
		{ property: 'og:image:type', content: 'image/png' },
		{ property: 'og:image:alt', content: title },
	])

	const twitterImages = images.map((image) => {
		return { name: 'twitter:image', content: image }
	})

	const truncateDescription =
		description.length > MAX_LENGTH_META_DESCRIPTION
			? description.slice(0, MAX_LENGTH_META_DESCRIPTION) + '...'
			: description

	const fullUrl = url.startsWith('http') ? url : `https://${url}`

	const metas = [
		{ title },
		{ name: 'title', content: title },
		{ name: 'description', content: truncateDescription },
		{ name: 'keywords', content: allKeywords },
		{ name: 'robots', content: 'index, follow' },
		{ name: 'author', content: capitalize(APP_NAME) },
		{ tagName: 'link', rel: 'canonical', href: fullUrl },
		{ property: 'og:url', content: fullUrl },
		{ property: 'og:site_name', content: capitalize(APP_NAME) },
		{ property: 'og:type', content: 'website' },
		{ property: 'og:title', content: title },
		{ property: 'og:description', content: truncateDescription },
		...ogImages,
		{
			name: 'twitter:card',
			content: images.length ? 'summary_large_image' : 'summary',
		},
		{ name: 'twitter:url', content: fullUrl },
		{ name: 'twitter:title', content: title },
		{ name: 'twitter:description', content: truncateDescription },
		...twitterImages,
		{ name: 'twitter:image:alt', content: title },
	]

	if (images[0]) {
		metas.push({ name: 'image', content: images[0] })
	}

	return metas
}

export function getOrganizationSchema(origin: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name: capitalize(APP_NAME),
		url: origin,
		logo: `${origin}/logo.png`,
	}
}

export function getWebsiteSchema(origin: string) {
	return {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: capitalize(APP_NAME),
		url: origin,
	}
}

export function getFaqSchema(faqs: { question: string; answer: string }[]) {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	}
}

export function getBreadcrumbSchema(
	origin: string,
	crumbs: { name: string; path: string }[],
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: crumbs.map((crumb, index) => ({
			'@type': 'ListItem',
			position: index + 1,
			name: crumb.name,
			item: `${origin}${crumb.path}`,
		})),
	}
}
