import { data } from 'react-router'
import type { Route } from './+types/api.language'
import { languageCookie } from '~/lib/i18n/language.server'
import { isLanguage } from '~/lib/i18n/languages'

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const language = formData.get('language')

	if (!isLanguage(language)) {
		return data({ ok: false }, { status: 400 })
	}

	return data(
		{ ok: true },
		{ headers: { 'Set-Cookie': await languageCookie.serialize(language) } },
	)
}
