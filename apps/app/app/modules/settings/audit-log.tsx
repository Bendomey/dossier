import { useState } from 'react'
import { useGetAuditEvents } from '~/api/audit-events'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import SegmentedControl from '~/components/arc/segmented-control/segmented-control'
import { Skeleton } from '~/components/arc/skeleton/skeleton'

type Filter = 'ALL' | AuditCategory

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: 'ALL', label: 'All activity' },
	{ value: 'DOCUMENTS', label: 'Documents' },
	{ value: 'AI', label: 'AI work' },
	{ value: 'MEMBERS', label: 'Members' },
]

function downloadCsv(events: AuditEvent[]) {
	const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
	const rows = [
		['Time', 'Person', 'Action', 'Target', 'Category'],
		...events.map((event) => [
			event.time_label,
			event.actor,
			event.action,
			event.target,
			event.category,
		]),
	]
	const blob = new Blob(
		[rows.map((row) => row.map(escape).join(',')).join('\n')],
		{
			type: 'text/csv;charset=utf-8',
		},
	)
	const link = document.createElement('a')
	link.href = URL.createObjectURL(blob)
	link.download = 'dossier-audit-log.csv'
	link.click()
	URL.revokeObjectURL(link.href)
}

export function AuditLogSettingsModule() {
	const [filter, setFilter] = useState<Filter>('ALL')
	const { data: events, isPending } = useGetAuditEvents(
		filter === 'ALL' ? undefined : filter,
	)

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					label="Activity type"
					value={filter}
					onValueChange={(value) => setFilter(value as Filter)}
					options={FILTERS}
				/>
				<span className="flex-1" />
				<Button
					variant="secondary"
					size="sm"
					disabled={!events?.length}
					onClick={() => events && downloadCsv(events)}
				>
					Export CSV
				</Button>
			</div>
			{isPending ? (
				<Skeleton lines={6} label="Loading activity" />
			) : events?.length ? (
				<ol className="flex flex-col">
					{events.map((event) => (
						<li
							key={event.id}
							className="border-border-subtle grid grid-cols-[96px_1fr] gap-4 border-b py-3.5"
						>
							<span className="text-muted text-[13px] tabular-nums">
								{event.time_label}
							</span>
							<span className="text-sm leading-normal">
								<span className="font-medium">{event.actor}</span>{' '}
								<span className="text-secondary">{event.action}</span>{' '}
								{event.target}
							</span>
						</li>
					))}
				</ol>
			) : (
				<EmptyState
					title="No activity yet"
					description="Actions in this category will show up here."
				/>
			)}
		</div>
	)
}
