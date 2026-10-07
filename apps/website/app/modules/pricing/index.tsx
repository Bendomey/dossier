import { useState } from 'react'
import { Comparison } from './comparison'
import { ANNUAL_DISCOUNT, type BillingPeriod } from './content'
import { Faq } from './faq'
import { Plans } from './plans'
import SegmentedControl from '~/components/arc/segmented-control/segmented-control'
import { Container } from '~/components/layout/container'
import { Page } from '~/components/layout/page'
import { useTranslation } from '~/lib/i18n/use-translation'

export function Pricing() {
	const { t } = useTranslation()
	const [period, setPeriod] = useState<BillingPeriod>('annual')

	return (
		<Page>
			<Container className="flex flex-col items-center pt-14 pb-14 text-center md:pt-28">
				<h1 className="font-heading m-0 max-w-[860px] text-[clamp(40px,6.4vw,80px)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
					{t('pricing.hero.title')}
				</h1>
				<p className="text-muted-foreground mt-6 max-w-[560px] text-[clamp(17px,2.2vw,19px)] leading-[1.55] text-pretty">
					{t('pricing.hero.body')}
				</p>
				<div className="mt-10">
					<SegmentedControl
						label={t('pricing.billing.label')}
						value={period}
						onValueChange={(value) => setPeriod(value as BillingPeriod)}
						options={[
							{ value: 'monthly', label: t('pricing.billing.monthly') },
							{
								value: 'annual',
								label: t('pricing.billing.annual'),
								accessory: (
									<span className="text-[11px] opacity-75">
										−{ANNUAL_DISCOUNT * 100}%
									</span>
								),
							},
						]}
					/>
				</div>
			</Container>
			<Plans period={period} />
			<Comparison />
			<Faq />
			<section className="bg-muted border-t">
				<Container className="flex flex-col items-center gap-6 py-[72px] text-center md:py-[120px]">
					<h2 className="font-heading m-0 max-w-[720px] text-[clamp(32px,4.4vw,56px)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
						{t('pricing.cta.title')}
					</h2>
					<div className="flex flex-wrap justify-center gap-3">
						<a
							href="/#access"
							className="bg-foreground text-background rounded-full px-6 py-3.5 text-[15px] font-medium hover:opacity-90"
						>
							{t('nav.startFree')}
						</a>
						<a
							href="/#contact"
							className="border-input bg-background rounded-full border px-6 py-3.5 text-[15px] font-medium hover:border-[#c9c9ce] dark:hover:border-white/30"
						>
							{t('pricing.plans.talkToUs')}
						</a>
					</div>
				</Container>
			</section>
		</Page>
	)
}
