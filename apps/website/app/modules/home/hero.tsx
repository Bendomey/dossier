import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'

export function Hero() {
	const { t } = useTranslation()

	return (
		<Container className="flex flex-col items-center pt-14 pb-14 text-center md:pt-28">
			<div className="border-input text-muted-foreground mb-8 flex max-w-full items-center gap-2 rounded-[18px] border py-1.5 pr-3.5 pl-1.5 text-left text-xs leading-snug sm:rounded-full sm:pl-2 sm:text-[13px]">
				<span className="bg-brand-soft text-brand shrink-0 rounded-full px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap">
					{t('home.hero.badge')}
				</span>
				<span className="text-pretty">{t('home.hero.announcement')}</span>
			</div>
			<h1 className="font-heading m-0 max-w-[960px] text-[clamp(40px,7vw,88px)] leading-[1.02] font-medium tracking-[-0.035em] text-balance">
				{t('home.hero.title')}
			</h1>
			<p className="text-muted-foreground mt-7 max-w-[620px] text-[clamp(17px,2.2vw,19px)] leading-[1.55] text-pretty">
				{t('home.hero.body')}
			</p>
			<div className="mt-10 flex flex-wrap justify-center gap-3">
				<a
					href="#access"
					className="bg-foreground text-background rounded-full px-6 py-3.5 text-[15px] font-medium hover:opacity-90"
				>
					{t('nav.startFree')}
				</a>
				<a
					href="#product"
					className="border-input rounded-full border px-6 py-3.5 text-[15px] font-medium hover:border-[#c9c9ce] dark:hover:border-white/30"
				>
					{t('home.hero.secondaryCta')}
				</a>
			</div>
		</Container>
	)
}
