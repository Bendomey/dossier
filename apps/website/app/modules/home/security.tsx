import { SECURITY_POINTS } from './content'
import { MonoLabel } from './label'
import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'

export function Security() {
	const { t } = useTranslation()

	return (
		<section id="security" className="bg-muted border-t">
			<Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-12 py-[72px] md:py-[120px]">
				<div>
					<MonoLabel className="mb-5">{t('home.security.label')}</MonoLabel>
					<h2 className="font-heading m-0 text-[clamp(32px,3.6vw,44px)] leading-[1.08] font-medium tracking-[-0.025em] text-balance">
						{t('home.security.title')}
					</h2>
				</div>
				<dl className="m-0 flex min-w-0 flex-col md:col-span-2">
					{SECURITY_POINTS.map((point) => (
						<div
							key={t(point.title)}
							className="border-input grid gap-1.5 border-t py-[22px] last:border-b md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6"
						>
							<dt className="text-base font-semibold">{t(point.title)}</dt>
							<dd className="text-muted-foreground m-0 text-[15px] leading-[1.6]">
								{t(point.body)}
							</dd>
						</div>
					))}
				</dl>
			</Container>
		</section>
	)
}
