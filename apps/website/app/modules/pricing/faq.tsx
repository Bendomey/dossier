import { FAQS } from './content'
import { Accordion } from '~/components/arc/accordion/accordion'
import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'

export function Faq() {
	const { t } = useTranslation()

	return (
		<section className="border-t">
			<Container className="grid gap-x-16 gap-y-8 py-[72px] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:py-[120px]">
				<h2 className="font-heading m-0 text-[clamp(32px,3.6vw,44px)] leading-[1.08] font-medium tracking-[-0.025em]">
					{t('pricing.faq.title')}
				</h2>
				<Accordion
					items={FAQS.map((faq) => ({
						title: t(faq.question),
						content: t(faq.answer),
					}))}
				/>
			</Container>
		</section>
	)
}
