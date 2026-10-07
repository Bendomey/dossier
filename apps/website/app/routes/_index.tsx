import * as z from 'zod'
import type { Route } from './+types/_index'
import { getMetaMessages } from '~/lib/i18n/use-translation'
import { getDisplayUrl, getDomainUrl } from '~/lib/misc'
import {
	getOrganizationSchema,
	getSocialMetas,
	getWebsiteSchema,
	pageKeywords,
} from '~/lib/seo'
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
		return { ok: false as const, error: true }
	}

	// TODO: send the sign-up to the API once the endpoint exists.
	return { ok: true as const, email: parsed.data.email }
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
