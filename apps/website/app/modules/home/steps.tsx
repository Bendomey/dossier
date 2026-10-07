import { STEPS } from './content'
import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'

export function Steps() {
	const { t } = useTranslation()

	return (
		<section className="border-t">
			<Container className="py-[72px] md:py-[120px]">
				<h2 className="font-heading mt-0 mb-10 max-w-[640px] text-[clamp(32px,3.6vw,44px)] leading-[1.08] font-medium tracking-[-0.025em]">
					{t('home.steps.title')}
				</h2>
				<ol className="border-foreground m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] border-t p-0">
					{STEPS.map((step, index) => (
						<li key={t(step.title)} className="py-7 pr-8">
							<div
								aria-hidden="true"
								className="font-heading text-[40px] font-normal text-[#c4c5ca] dark:text-white/25"
							>
								{index + 1}
							</div>
							<h3 className="mt-4 mb-2 text-[17px] font-semibold">
								{t(step.title)}
							</h3>
							<p className="text-muted-foreground m-0 text-[15px] leading-[1.6]">
								{t(step.body)}
							</p>
						</li>
					))}
				</ol>
			</Container>
		</section>
	)
}
