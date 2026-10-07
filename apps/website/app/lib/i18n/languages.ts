export const LANGUAGES = [
	{ code: 'en', label: 'English' },
	{ code: 'fr', label: 'Français' },
	{ code: 'pt', label: 'Português' },
	{ code: 'es', label: 'Español' },
	{ code: 'sw', label: 'Kiswahili' },
] as const

export type Language = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: Language = 'en'

export function isLanguage(value: unknown): value is Language {
	return LANGUAGES.some((language) => language.code === value)
}
