import { APP_NAME } from './constants'

export function pageTitle(title?: string) {
	return [
		{ title: title ? `${title} · ${APP_NAME}` : APP_NAME },
		{ name: 'robots', content: 'noindex, nofollow' },
	]
}
