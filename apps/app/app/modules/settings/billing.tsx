import { useGetBillingOverview, useGetInvoices } from '~/api/billing'
import { Badge } from '~/components/arc/badge/badge'
import { Button } from '~/components/arc/button/button'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { UsageMeter } from '~/components/arc/usage-meter/usage-meter'
import { formatDate } from '~/lib/format'
import { useWebsiteUrl } from '~/lib/use-website-url'

export function BillingSettingsModule() {
	const { data: billing, isPending } = useGetBillingOverview()
	const { data: invoices } = useGetInvoices()
	const websiteUrl = useWebsiteUrl()

	if (isPending || !billing)
		return <Skeleton lines={6} label="Loading billing" />

	return (
		<div className="flex flex-col gap-5">
			<div className="flex flex-wrap items-center gap-5 rounded-[34px] border p-6">
				<div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
					<span className="text-secondary text-sm">Current plan</span>
					<span className="font-heading text-[30px] font-medium tracking-[-0.02em]">
						{billing.plan_label}
					</span>
					<span className="text-secondary text-sm">{billing.price_label}</span>
				</div>
				<div className="flex gap-2">
					<Button variant="secondary">Manage payment</Button>
					<Button
						onClick={() =>
							window.open(
								websiteUrl('/pricing', 'billing_change_plan'),
								'_blank',
								'noopener',
							)
						}
					>
						Change plan
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
				<div className="rounded-[26px] border px-5 py-[18px]">
					<UsageMeter
						label="Seats"
						decimals={0}
						limit={billing.seats.limit}
						segments={[
							{ id: 'seats', label: 'In use', value: billing.seats.used },
						]}
						freeLabel="Available"
					/>
				</div>
				<div className="rounded-[26px] border px-5 py-[18px]">
					<UsageMeter
						label="Documents"
						decimals={0}
						limit={billing.documents.limit}
						segments={[
							{
								id: 'documents',
								label: billing.documents.storage_label,
								value: billing.documents.used,
							},
						]}
					/>
				</div>
				<div className="rounded-[26px] border px-5 py-[18px]">
					<UsageMeter
						label="Contract reviews"
						decimals={0}
						limit={billing.reviews.limit}
						segments={[
							{
								id: 'reviews',
								label: 'Used',
								value: billing.reviews.used,
							},
						]}
						freeLabel="Remaining"
					/>
					<p className="text-muted mt-2 text-xs">
						Resets on {formatDate(billing.reviews.resets_on)}
					</p>
				</div>
			</div>

			<section className="flex flex-col gap-2.5">
				<h2 className="text-[15px] font-medium">Invoices</h2>
				<ul className="overflow-hidden rounded-[26px] border">
					{invoices?.map((invoice) => (
						<li
							key={invoice.id}
							className="border-border-subtle flex items-center gap-4 border-t px-[18px] py-3.5 text-sm first:border-t-0"
						>
							<span className="flex-1">{formatDate(invoice.issued_on)}</span>
							<span className="text-secondary tabular-nums">
								{invoice.amount}
							</span>
							<Badge tone="success" size="sm">
								Paid
							</Badge>
							<Button variant="ghost" size="sm">
								Download
							</Button>
						</li>
					)) ?? (
						<li className="p-5">
							<Skeleton lines={3} label="Loading invoices" />
						</li>
					)}
				</ul>
			</section>
		</div>
	)
}
