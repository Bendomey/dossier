import { Check } from 'lucide-react'
import { Link } from 'react-router'
import {
	ANNUAL_DISCOUNT,
	type BillingPeriod,
	PLANS,
	type Plan,
} from './content'
import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'
import { cn } from '~/lib/utils'

export function Plans({ period }: { period: BillingPeriod }) {
	const { t } = useTranslation()

	return (
		<Container className="pb-[72px] md:pb-[120px]">
			<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] items-stretch gap-4">
				{PLANS.map((plan) => (
					<PlanCard key={plan.name} plan={plan} period={period} />
				))}
			</div>
			<p className="text-subtle mt-5 text-center text-[13px]">
				{t('pricing.plans.note')}
			</p>
		</Container>
	)
}

function PlanCard({ plan, period }: { plan: Plan; period: BillingPeriod }) {
	const { t } = useTranslation()
	const annual = period === 'annual'

	const price =
		plan.monthlyPrice === null
			? t('pricing.plans.custom')
			: `$${annual ? Math.round(plan.monthlyPrice * (1 - ANNUAL_DISCOUNT)) : plan.monthlyPrice}`

	const unit =
		plan.monthlyPrice === null
			? ''
			: plan.monthlyPrice === 0
				? t('pricing.plans.forever')
				: annual
					? t('pricing.plans.perUserYearly')
					: t('pricing.plans.perUserMonthly')

	return (
		<div
			className={cn(
				'bg-background flex flex-col gap-6 rounded-[18px] border p-[22px] transition-transform duration-250 hover:-translate-y-[3px] md:p-8',
				plan.popular && 'border-foreground',
			)}
		>
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<h2 className="font-heading text-2xl font-medium tracking-[-0.02em]">
						{plan.name}
					</h2>
					{plan.popular ? (
						<span className="bg-brand-soft text-brand rounded-full px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap">
							{t('pricing.plans.popular')}
						</span>
					) : null}
				</div>
				<p className="text-muted-foreground min-h-[42px] text-sm leading-normal">
					{t(plan.blurb)}
				</p>
			</div>
			<div className="flex min-h-[52px] items-baseline gap-1.5">
				<span
					key={price}
					className="font-heading animate-in fade-in slide-in-from-top-1.5 text-[44px] leading-none font-medium tracking-[-0.03em] tabular-nums duration-350"
				>
					{price}
				</span>
				<span className="text-subtle text-[13px]">{unit}</span>
			</div>
			<Link
				to={plan.ctaHref}
				className={cn(
					'rounded-full border px-[18px] py-3 text-center text-sm font-medium',
					plan.popular
						? 'border-foreground bg-foreground text-background hover:opacity-90'
						: 'border-input bg-background hover:border-[#c9c9ce] dark:hover:border-white/30',
				)}
			>
				{t(plan.cta)}
			</Link>
			<div className="flex flex-col gap-2.5 border-t pt-5 text-sm leading-[1.45]">
				<span className="text-subtle font-mono text-[11px] tracking-[.06em] uppercase">
					{t(plan.lead)}
				</span>
				<ul className="m-0 flex list-none flex-col gap-2.5 p-0">
					{plan.items.map((item) => (
						<li key={item} className="flex gap-2.5">
							<Check
								aria-hidden="true"
								className="text-brand mt-0.5 size-4 flex-none"
								strokeWidth={1.5}
							/>
							<span>{t(item)}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}
