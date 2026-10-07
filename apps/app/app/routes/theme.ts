import { data } from 'react-router'
import type { Route } from './+types/theme'
import { isTheme, themeCookie } from '~/lib/actions/theme.server'

export async function action({ request }: Route.ActionArgs) {
	const theme = (await request.formData()).get('theme')
	if (!isTheme(theme)) return data({ ok: false }, { status: 400 })

	return data(
		{ ok: true },
		{ headers: { 'Set-Cookie': await themeCookie.serialize(theme) } },
	)
}
