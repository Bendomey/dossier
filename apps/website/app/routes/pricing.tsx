import type { Route } from './+types/pricing'
import { getMetaMessages } from '~/lib/i18n/use-translation'
import { getDisplayUrl, getDomainUrl } from '~/lib/misc'
import { getFaqSchema, getSocialMetas } from '~/lib/seo'
import { Pricing } from '~/modules'
import { FAQS } from '~/modules/pricing/content'

export async function loader({ request }: Route.LoaderArgs) {
	return {
		origin: getDomainUrl(request),
	}
}

export function meta({ loaderData, location, matches }: Route.MetaArgs) {
	const t = getMetaMessages(matches)
	const url = getDisplayUrl({
		origin: loaderData.origin,
		path: location.pathname,
	})

	return [
		...getSocialMetas({
			url,
			origin: loaderData.origin,
			title: t['pricing.meta.title'],
			description: t['pricing.meta.description'],
			images: [`${loaderData.origin}/images/og-pricing.png`],
		}),
		{
			'script:ld+json': getFaqSchema(
				FAQS.map((faq) => ({
					question: t[faq.question],
					answer: t[faq.answer],
				})),
			),
		},
	]
}

export default Pricing
