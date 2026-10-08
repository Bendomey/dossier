import { useEffect, useState } from 'react'
import { useFetcher, useLoaderData, useSearchParams } from 'react-router'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import SegmentedControl from '~/components/arc/segmented-control/segmented-control'
import { useAppBase } from '~/providers/app-base-provider'

type Filter = 'all' | Lowercase<AuditCategory>

const FILTERS: Array<{ value: Filter; label: string }> = [
	{ value: 'all', label: 'All activity' },
	{ value: 'documents', label: 'Documents' },
	{ value: 'ai', label: 'AI work' },
	{ value: 'members', label: 'Members' },
	{ value: 'workspace', label: 'Workspace' },
]

const isFilter = (value: string | null): value is Filter =>
	FILTERS.some((filter) => filter.value === value)

/** The demo has no server export, so it builds the file from what is on screen. */
function downloadCsv(entries: AuditEntry[]) {
	const escape = (value: string) => `"${value.replaceAll('"', '""')}"`
	const rows = [
		['Time', 'Person', 'Action', 'Target', 'Category'],
		...entries.map((entry) => [
			entry.time_label,
			entry.actor,
			entry.action,
			entry.target,
			entry.category,
		]),
	]
	const link = document.createElement('a')
	link.href = URL.createObjectURL(
		new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], {
			type: 'text/csv;charset=utf-8',
		}),
	)
	link.download = 'dossier-audit-log.csv'
	link.click()
	URL.revokeObjectURL(link.href)
}

function groupByDay(entries: AuditEntry[]) {
	const days: Array<{ label: string; entries: AuditEntry[] }> = []
	for (const entry of entries) {
		const last = days.at(-1)
		if (last?.label === entry.day_label) last.entries.push(entry)
		else days.push({ label: entry.day_label, entries: [entry] })
	}
	return days
}

export function AuditLogSettingsModule() {
	const firstPage = useLoaderData() as AuditLogPage
	const [searchParams, setSearchParams] = useSearchParams()
	const { path, demo } = useAppBase()
	const older = useFetcher<AuditLogPage>()
	const [extra, setExtra] = useState<AuditLogPage[]>([])

	const category = searchParams.get('category')
	const filter: Filter = isFilter(category) ? category : 'all'

	useEffect(() => setExtra([]), [firstPage])
	useEffect(() => {
		if (older.state === 'idle' && older.data) {
			const page = older.data
			setExtra((pages) => (pages.includes(page) ? pages : [...pages, page]))
		}
	}, [older.state, older.data])

	const entries = [firstPage, ...extra].flatMap((page) => page.entries)
	const nextCursor = (extra.at(-1) ?? firstPage).next_cursor
	const query = (params: Record<string, string>) =>
		`?${new URLSearchParams(filter === 'all' ? params : { category: filter, ...params })}`

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<SegmentedControl
					label="Activity type"
					value={filter}
					onValueChange={(value) =>
						setSearchParams(value === 'all' ? {} : { category: value }, {
							preventScrollReset: true,
						})
					}
					options={FILTERS}
				/>
				<span className="flex-1" />
				{demo ? (
					<Button
						variant="secondary"
						size="sm"
						disabled={!entries.length}
						onClick={() => downloadCsv(entries)}
					>
						Export CSV
					</Button>
				) : entries.length ? (
					<Button
						variant="secondary"
						size="sm"
						onClick={() =>
							window.location.assign(
								`${path('/settings/audit-log.csv')}${query({})}`,
							)
						}
					>
						Export CSV
					</Button>
				) : null}
			</div>
			{entries.length ? (
				<>
					{groupByDay(entries).map((day) => (
						<section key={day.label} className="flex flex-col">
							<h2 className="text-secondary border-border-subtle border-b pb-2 text-[13px] font-medium">
								{day.label}
							</h2>
							<ol className="flex flex-col">
								{day.entries.map((entry) => (
									<li
										key={entry.id}
										className="border-border-subtle grid grid-cols-[64px_1fr] gap-4 border-b py-3.5"
									>
										<time
											dateTime={entry.occurred_at || undefined}
											className="text-muted text-[13px] tabular-nums"
										>
											{entry.time_label}
										</time>
										<span className="text-sm leading-normal">
											<span className="font-medium">{entry.actor}</span>{' '}
											<span className="text-secondary">{entry.action}</span>
											{entry.target ? ` ${entry.target}` : null}
										</span>
									</li>
								))}
							</ol>
						</section>
					))}
					{nextCursor ? (
						<Button
							variant="secondary"
							className="self-center"
							loading={older.state !== 'idle'}
							onClick={() =>
								older.load(
									`${path('/settings/audit-log')}${query({ before: nextCursor })}`,
								)
							}
						>
							Load older activity
						</Button>
					) : null}
					<p className="text-muted text-xs">Times are in GMT.</p>
				</>
			) : (
				<EmptyState
					title="No activity yet"
					description={
						filter === 'all'
							? 'Changes to people, groups, documents and settings will show up here.'
							: 'Nothing in this category yet.'
					}
				/>
			)}
		</div>
	)
}
