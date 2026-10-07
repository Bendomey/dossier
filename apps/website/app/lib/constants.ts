export const NODE_ENV = process.env.NODE_ENV
export const APP_NAME = 'dossier'
export const APP_DOMAIN =
	NODE_ENV === 'production' ? 'dossier.africa' : 'localhost'

export const APP_URL = '#'

export const CONTACT_EMAIL = 'hello@dossier.africa'
export const WHATSAPP_NUMBER = '+233 00 000 0000'

/**
 * Base URL of the live product the home page demo embeds, e.g.
 * `https://app.dossier.africa/demo`. While empty, the demo shows a placeholder.
 */
export const PRODUCT_DEMO_URL = ''

export const QUERY_KEYS = {} as const

export const PAGINATION_DEFAULTS = {
	PAGE: 1,
	PER_PAGE: 50,
} as const

export const API_STATUS = {
	IDLE: 'idle',
	PENDING: 'pending',
	SUCCESS: 'success',
	ERROR: 'error',
} as const
export type APIStatusType = (typeof API_STATUS)[keyof typeof API_STATUS]

// base64 1px png's generated from https://png-pixel.com/
const placeholderColor =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+/79fwAJaAPMsmQeyQAAAABJRU5ErkJggg==' // grey-10 as 1px png in base64
export const blurDataURL = `data:image/png;base64,${placeholderColor}`
