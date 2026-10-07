import { type Cell, COMPARISON, PLANS } from './content'
import { Container } from '~/components/layout/container'
import { useTranslation } from '~/lib/i18n/use-translation'

export function Comparison() {
	const { t } = useTranslation()

	function renderCell(cell: Cell) {
		if (typeof cell === 'string') return cell
		if ('key' in cell) return t(cell.key)
		return `${cell.value} ${t(cell.unit)}`
	}

	return (
		<section className="border-t">
			<Container className="py-[72px] md:py-[120px]">
				<h2 className="font-heading mt-0 mb-10 text-[clamp(32px,3.6vw,44px)] leading-[1.08] font-medium tracking-[-0.025em]">
					{t('pricing.compare.title')}
				</h2>
				<div className="overflow-x-auto rounded-[18px] border">
					<table className="w-full min-w-[720px] border-collapse text-left text-sm">
						<thead className="bg-muted">
							<tr className="border-b">
								<th
									scope="col"
									className="text-subtle bg-muted sticky left-0 z-[1] w-40 px-4 py-[18px] font-mono text-[11px] font-normal tracking-[.06em] uppercase shadow-[1px_0_0_var(--border)] md:w-[32%] md:px-6 md:shadow-none"
								>
									{t('pricing.compare.feature')}
								</th>
								{PLANS.map((plan) => (
									<th key={plan.name} scope="col" className="p-4 font-semibold">
										{plan.name}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{COMPARISON.map((row) => (
								<tr
									key={row.feature}
									className="border-b border-[#f0f0f2] last:border-b-0 dark:border-white/5"
								>
									<th
										scope="row"
										className="bg-background sticky left-0 z-[1] px-4 py-4 font-normal shadow-[1px_0_0_var(--border)] md:px-6 md:shadow-none"
									>
										{t(row.feature)}
									</th>
									{row.cells.map((cell, index) => (
										<td key={index} className="text-muted-foreground p-4">
											{renderCell(cell)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</Container>
		</section>
	)
}
