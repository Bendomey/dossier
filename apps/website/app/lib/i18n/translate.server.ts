import { type Language, DEFAULT_LANGUAGE } from './languages'
import { type MessageKey, type Messages, messages } from './messages'
import { environmentVariables } from '~/lib/actions/env.server'

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'
const MAX_SEGMENTS_PER_REQUEST = 128
const PROTECTED_TERMS = ['Dossier']

const cache = new Map<Language, Promise<Messages>>()

export function getMessages(language: Language): Promise<Messages> {
	const apiKey = environmentVariables().GOOGLE_TRANSLATE_API_KEY
	if (language === DEFAULT_LANGUAGE || !apiKey) return Promise.resolve(messages)

	let pending = cache.get(language)
	if (!pending) {
		pending = translateAll(language, apiKey).catch((error: unknown) => {
			cache.delete(language)
			console.error(`Translating site copy to "${language}" failed`, error)
			return messages
		})
		cache.set(language, pending)
	}
	return pending
}

async function translateAll(language: Language, apiKey: string) {
	const keys = Object.keys(messages) as MessageKey[]
	const translated: Partial<Messages> = {}

	for (let start = 0; start < keys.length; start += MAX_SEGMENTS_PER_REQUEST) {
		const batch = keys.slice(start, start + MAX_SEGMENTS_PER_REQUEST)
		const results = await requestTranslations(
			batch.map((key) => protect(messages[key])),
			language,
			apiKey,
		)
		batch.forEach((key, index) => {
			translated[key] = unprotect(results[index] ?? messages[key])
		})
	}

	return translated as Messages
}

async function requestTranslations(
	segments: string[],
	target: Language,
	apiKey: string,
) {
	const response = await fetch(
		`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				q: segments,
				source: DEFAULT_LANGUAGE,
				target,
				format: 'html',
			}),
		},
	)

	if (!response.ok) {
		throw new Error(`${response.status} ${await response.text()}`)
	}

	const body = (await response.json()) as {
		data: { translations: Array<{ translatedText: string }> }
	}
	return body.data.translations.map((item) => item.translatedText)
}

/*
 * Sent as HTML so brand names can be wrapped in `notranslate` spans, which
 * means the copy has to be escaped on the way out and decoded on the way back.
 */
function protect(text: string) {
	let html = text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
	for (const term of PROTECTED_TERMS) {
		html = html.replaceAll(term, `<span class="notranslate">${term}</span>`)
	}
	return html
}

function unprotect(html: string) {
	return html
		.replace(/<span class="notranslate">(.*?)<\/span>/g, '$1')
		.replace(/&#(\d+);/g, (_, code: string) =>
			String.fromCharCode(Number(code)),
		)
		.replaceAll('&quot;', '"')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&amp;', '&')
}
