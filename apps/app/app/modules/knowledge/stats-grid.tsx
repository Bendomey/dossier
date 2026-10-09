import { cn } from '~/lib/utils'

export function StatsGrid({ stats }: { stats?: KnowledgeStats }) {
	const items = [
		{ label: 'Documents', value: stats?.total },
		{ label: 'Ready for AI', value: stats?.ready, dot: 'bg-success' },
		{ label: 'Processing', value: stats?.processing, dot: 'bg-accent' },
		{ label: 'Approved templates', value: stats?.templates },
	]

	return (
		<dl className="bg-border-subtle grid grid-cols-2 gap-px overflow-hidden rounded-[26px] border md:grid-cols-4">
			{items.map((item) => (
				<div
					key={item.label}
					className="bg-background flex flex-col gap-1 px-[22px] py-[18px]"
				>
					<dt className="text-secondary flex items-center gap-1.5 text-[13px]">
						{item.dot ? (
							<span className={cn('size-1.5 rounded-full', item.dot)} />
						) : null}
						{item.label}
					</dt>
					<dd className="font-heading text-[30px] font-medium tracking-[-0.02em] tabular-nums">
						{item.value ?? '–'}
					</dd>
				</div>
			))}
		</dl>
	)
}
