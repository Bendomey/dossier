import { Form, useActionData, useNavigation } from 'react-router'
import { Button } from '~/components/arc/button/button'
import { Container } from '~/components/layout/container'
import { CONTACT_EMAIL, WHATSAPP_NUMBER } from '~/lib/constants'
import { useTranslation } from '~/lib/i18n/use-translation'
import type { action } from '~/routes/_index'

export function Access() {
	const { t } = useTranslation()
	const navigation = useNavigation()
	const submitting =
		navigation.state !== 'idle' && navigation.formMethod === 'POST'
	const result = useActionData<typeof action>()

	return (
		<section id="access" className="scroll-mt-16 border-t">
			<span id="contact" className="block scroll-mt-16" />
			<Container className="flex flex-col items-center py-[92px] text-center md:py-[140px]">
				<h2 className="font-heading m-0 max-w-[820px] text-[clamp(36px,5.6vw,72px)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
					{t('home.access.title')}
				</h2>
				<p className="text-muted-foreground mt-6 mb-10 text-[17px]">
					{t('home.access.body')}
				</p>
				<Form
					method="post"
					className="border-input focus-within:border-foreground flex w-full max-w-[460px] gap-2 rounded-full border p-1.5 transition-colors"
				>
					<label htmlFor="access-email" className="sr-only">
						{t('home.access.emailLabel')}
					</label>
					<input
						id="access-email"
						name="email"
						type="email"
						required
						autoComplete="email"
						placeholder={t('home.access.emailLabel')}
						aria-invalid={result?.error ? true : undefined}
						aria-describedby={result?.error ? 'access-email-error' : undefined}
						className="placeholder:text-subtle min-w-0 flex-1 border-0 bg-transparent px-4 text-[15px] outline-none"
					/>
					<Button type="submit" loading={submitting}>
						{t('nav.startFree')}
					</Button>
				</Form>
				{result?.error ? (
					<p
						id="access-email-error"
						role="alert"
						className="text-destructive mt-3 text-sm"
					>
						{t('home.access.invalidEmail')}
					</p>
				) : null}
				<div className="text-muted-foreground mt-9 flex flex-wrap justify-center gap-x-7 gap-y-2.5 text-sm">
					<span>{t('home.access.talkFirst')}</span>
					<a
						href={`mailto:${CONTACT_EMAIL}`}
						className="text-foreground hover:text-brand font-medium"
					>
						{CONTACT_EMAIL}
					</a>
					<a
						href={`https://wa.me/${WHATSAPP_NUMBER.replace(/\D/g, '')}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-foreground hover:text-brand font-medium"
					>
						WhatsApp {WHATSAPP_NUMBER}
					</a>
				</div>
				<p className="text-subtle mt-5 text-[13px]">
					{t('home.access.builtIn')}
				</p>
			</Container>
		</section>
	)
}
