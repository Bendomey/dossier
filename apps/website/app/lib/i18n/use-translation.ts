import { useRouteLoaderData } from 'react-router'
import { DEFAULT_LANGUAGE, type Language } from './languages'
import { type MessageKey, type Messages, messages } from './messages'

interface RootI18nData {
	language: Language
	messages: Messages
}

export function useTranslation() {
	const data = useRouteLoaderData('root') as RootI18nData | undefined
	const dictionary = data?.messages ?? messages

	return {
		language: data?.language ?? DEFAULT_LANGUAGE,
		t: (key: MessageKey) => dictionary[key],
	}
}

/** Reads the root loader's dictionary inside a route `meta` function. */
export function getMetaMessages(
	matches: ReadonlyArray<{ id: string; data?: unknown } | undefined>,
): Messages {
	const root = matches.find((match) => match?.id === 'root')?.data as
		| Partial<RootI18nData>
		| undefined
	return root?.messages ?? messages
}
