import { ArrowUp } from 'lucide-react'
import { EXTRAS, FEATURES, type DemoTab } from './content'
import { MonoLabel } from './label'
import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'

interface Props {
	onTry: (tab: DemoTab) => void
}

export function Features({ onTry }: Props) {
	const { t } = useTranslation()

	return (
		<section id="product" className="border-t">
			<Container className="py-[72px] md:py-[120px]">
				<div className="mb-12 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-end gap-x-12 gap-y-6">
					<h2 className="font-heading m-0 text-[clamp(36px,4.6vw,56px)] leading-[1.04] font-medium tracking-[-0.03em] text-balance">
						{t('home.features.title')}
					</h2>
					<p className="text-muted-foreground m-0 max-w-[460px] text-[17px] leading-[1.6] text-pretty">
						{t('home.features.body')}
					</p>
				</div>
				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,480px),1fr))] gap-4">
					{FEATURES.map((feature, index) => (
						<div
							key={feature.tag}
							className="flex flex-col gap-6 rounded-[18px] border p-[22px] transition-colors hover:border-[#d4d4d8] md:p-8 dark:hover:border-white/20"
						>
							<div>
								<MonoLabel>
									{String(index + 1).padStart(2, '0')} · {t(feature.tag)}
								</MonoLabel>
								<h3 className="font-heading mt-2.5 mb-2 text-[26px] font-medium tracking-[-0.02em]">
									{t(feature.title)}
								</h3>
								<p className="text-muted-foreground m-0 text-[15px] leading-[1.6]">
									{t(feature.body)}
								</p>
							</div>
							<button
								type="button"
								onClick={() => onTry(feature.tab)}
								className="border-input bg-background hover:border-foreground mt-auto flex h-9 cursor-pointer items-center gap-2 self-start rounded-full border px-3.5 text-sm transition-colors"
							>
								{t('home.features.try')}
								<ArrowUp className="size-3.5" strokeWidth={1.75} />
							</button>
						</div>
					))}
				</div>
				<div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] rounded-[18px] border">
					{EXTRAS.map((extra, index) => (
						<div
							key={t(extra.title)}
							className={
								index === 0
									? 'flex flex-col gap-1.5 px-[22px] py-6 md:px-8'
									: 'flex flex-col gap-1.5 border-t px-[22px] py-6 md:border-t-0 md:border-l md:px-8'
							}
						>
							<MonoLabel>{t('home.features.also')}</MonoLabel>
							<strong className="text-[15px] font-semibold">
								{t(extra.title)}
							</strong>
							<span className="text-muted-foreground text-sm leading-[1.55]">
								{t(extra.body)}
							</span>
						</div>
					))}
				</div>
			</Container>
		</section>
	)
}
