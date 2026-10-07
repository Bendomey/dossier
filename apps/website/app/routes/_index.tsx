import { redirect } from 'react-router'
import * as z from 'zod'
import type { Route } from './+types/_index'
import { APP_URL } from '~/lib/constants'
import { getMetaMessages } from '~/lib/i18n/use-translation'
import { getDisplayUrl, getDomainUrl } from '~/lib/misc'
import {
	getOrganizationSchema,
	getSocialMetas,
	getWebsiteSchema,
	pageKeywords,
} from '~/lib/seo'
import { WEBSITE_UTM_SOURCE } from '~/lib/use-app-url'
import { crossAppUrl } from '~/lib/utm'
import { resolveUtm } from '~/lib/utm.server'
import { Home } from '~/modules'

export async function loader({ request }: Route.LoaderArgs) {
	return {
		origin: getDomainUrl(request),
	}
}

const accessSchema = z.object({
	email: z.email(),
})

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const parsed = accessSchema.safeParse({ email: formData.get('email') })

	if (!parsed.success) {
		return { error: true }
	}

	const { utm } = await resolveUtm(request)
	throw redirect(
		crossAppUrl(APP_URL, '/signup', {
			utm,
			source: WEBSITE_UTM_SOURCE,
			placement: 'access_form',
			params: { email: parsed.data.email },
		}),
	)
}

export function meta({ loaderData, location, matches }: Route.MetaArgs) {
	const t = getMetaMessages(matches)
	const url = getDisplayUrl({
		origin: loaderData.origin,
		path: location.pathname,
	})

	const meta = getSocialMetas({
		url,
		origin: loaderData.origin,
		title: t['home.meta.title'],
		description: t['home.meta.description'],
		keywords: pageKeywords.home,
	})

	const structuredData = [
		getOrganizationSchema(loaderData.origin),
		getWebsiteSchema(loaderData.origin),
	]

	return [
		...meta,
		{
			'script:ld+json': structuredData,
		},
	]
}

export default Home
