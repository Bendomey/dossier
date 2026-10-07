import { Container } from './container'
import { type MessageKey } from '~/lib/i18n/messages'
import { useTranslation } from '~/lib/i18n/use-translation'

const FOOTER_LINKS: Array<{ key: MessageKey; href: string }> = [
	{ key: 'footer.privacy', href: '#' },
	{ key: 'footer.terms', href: '#' },
	{ key: 'footer.security', href: '/#security' },
	{ key: 'footer.contact', href: '/#contact' },
]

export function Footer() {
	const { t } = useTranslation()

	return (
		<footer className="border-t">
			<Container className="text-subtle flex flex-wrap items-center justify-between gap-6 py-8 text-[13px]">
				<span>
					© {new Date().getFullYear()} {t('footer.company')}
				</span>
				<div className="flex flex-wrap gap-5">
					{FOOTER_LINKS.map((link) => (
						<a key={link.key} href={link.href} className="hover:text-brand">
							{t(link.key)}
						</a>
					))}
				</div>
			</Container>
		</footer>
	)
}
