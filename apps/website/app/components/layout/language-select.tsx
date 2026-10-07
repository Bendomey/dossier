import { useFetcher } from 'react-router'
import { LANGUAGES, type Language } from '~/lib/i18n/languages'
import { useTranslation } from '~/lib/i18n/use-translation'

export function LanguageSelect() {
	const fetcher = useFetcher()
	const { language, t } = useTranslation()
	const pending = fetcher.formData?.get('language') as Language | undefined

	return (
		<select
			aria-label={t('nav.language')}
			value={pending ?? language}
			disabled={fetcher.state !== 'idle'}
			onChange={(event) =>
				fetcher.submit(
					{ language: event.target.value },
					{ method: 'post', action: '/api/language' },
				)
			}
			className="border-input bg-background text-muted-foreground cursor-pointer appearance-none rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase outline-none hover:border-[#c9c9ce] disabled:cursor-progress dark:hover:border-white/30"
		>
			{LANGUAGES.map(({ code, label }) => (
				<option key={code} value={code} aria-label={label}>
					{code.toUpperCase()}
				</option>
			))}
		</select>
	)
}
