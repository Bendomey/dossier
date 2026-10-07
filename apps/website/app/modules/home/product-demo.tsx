import { DEMO_TABS, type DemoTab } from './content'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '~/components/arc/tabs/tabs'
import { Container } from '~/components/layout/container'
import { APP_URL, PRODUCT_DEMO_URL } from '~/lib/constants'
import { useTranslation } from '~/lib/i18n/use-translation'

interface Props {
	tab: DemoTab
	onTabChange: (tab: DemoTab) => void
}

export function ProductDemo({ tab, onTabChange }: Props) {
	const { t } = useTranslation()
	const active = DEMO_TABS.find((item) => item.value === tab) ?? DEMO_TABS[0]

	return (
		<Container id="demo" className="scroll-mt-22 pb-[72px] md:pb-[120px]">
			<Tabs
				value={tab}
				onValueChange={(value) => onTabChange(value as DemoTab)}
			>
				<div className="mb-4 flex justify-center">
					<TabsList aria-label={t('home.demo.label')}>
						{DEMO_TABS.map((item) => (
							<TabsTrigger key={item.value} value={item.value}>
								{t(item.label)}
							</TabsTrigger>
						))}
					</TabsList>
				</div>
				<div className="rounded-[22px] border border-[#e4e4e7] bg-[#fafafa] p-1.5 shadow-[0_1px_2px_rgba(12,13,15,.04),0_24px_60px_-24px_rgba(12,13,15,.18)] dark:border-white/10 dark:bg-white/[.03]">
					<div className="flex h-[34px] items-center gap-3 px-3">
						<span className="flex gap-1.5" aria-hidden="true">
							<span className="size-2.5 rounded-full bg-[#e4e4e7] dark:bg-white/15" />
							<span className="size-2.5 rounded-full bg-[#e4e4e7] dark:bg-white/15" />
							<span className="size-2.5 rounded-full bg-[#e4e4e7] dark:bg-white/15" />
						</span>
						<span className="text-subtle flex-1 text-center text-xs">
							{new URL(APP_URL).host}
						</span>
						<span className="w-[42px]" />
					</div>
					{DEMO_TABS.map((item) => (
						<TabsContent key={item.value} value={item.value}>
							<div className="bg-background h-[clamp(520px,68vw,680px)] overflow-hidden rounded-2xl border">
								{PRODUCT_DEMO_URL ? (
									<iframe
										src={`${PRODUCT_DEMO_URL}?${item.query}`}
										title={`Dossier: ${t(item.label)}`}
										className="block size-full border-0"
									/>
								) : (
									<div className="text-subtle grid size-full place-items-center text-sm">
										{t(item.label)}
									</div>
								)}
							</div>
						</TabsContent>
					))}
				</div>
			</Tabs>
			<p className="text-subtle mt-3.5 text-center text-[13px]">
				{t(active.note)}
			</p>
		</Container>
	)
}
