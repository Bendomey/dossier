import { Fragment } from 'react'
import { useLoaderData, useSearchParams } from 'react-router'
import { useGetAuditPages } from '~/api/audit-events'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import SegmentedControl from '~/components/arc/segmented-control/segmented-control'
import { LoadMore } from '~/components/load-more'
import { useAppBase } from '~/providers/app-base-provider'
import { useSession } from '~/providers/session-provider'

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

function AuditRows({
	entries,
	previous,
}: {
	entries: AuditEntry[]
	previous: AuditEntry | undefined
}) {
	return entries.map((entry, index) => {
		const before = index ? entries[index - 1] : previous
		return (
			<Fragment key={entry.id}>
				{before?.day_label !== entry.day_label ? (
					<li className="text-secondary border-border-subtle border-b pt-4 pb-2 text-[13px] font-medium first:pt-0">
						<h2>{entry.day_label}</h2>
					</li>
				) : null}
				<li className="border-border-subtle grid grid-cols-[64px_1fr] gap-4 border-b py-3.5">
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
			</Fragment>
		)
	})
}

export function AuditLogSettingsModule() {
	const firstPage = useLoaderData() as AuditLogPage
	const [searchParams, setSearchParams] = useSearchParams()
	const { path, demo } = useAppBase()

	const { organization } = useSession()
	const category = searchParams.get('category')
	const filter: Filter = isFilter(category) ? category : 'all'
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useGetAuditPages(
			firstPage,
			organization.id,
			filter === 'all' ? null : filter,
		)
	const entries = data.pages.flatMap((page) => page.entries)
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
				{firstPage.entries.length ? (
					<Button
						variant="secondary"
						size="sm"
						onClick={() =>
							demo
								? downloadCsv(entries)
								: window.location.assign(
										`${path('/settings/audit-log.csv')}${query({})}`,
									)
						}
					>
						Export CSV
					</Button>
				) : null}
			</div>
			{firstPage.entries.length ? (
				<>
					<ol className="flex flex-col">
						<AuditRows entries={entries} previous={undefined} />
						<LoadMore
							as="li"
							hasMore={hasNextPage}
							loading={isFetchingNextPage}
							onLoadMore={() => void fetchNextPage()}
							label="Loading older activity…"
						/>
					</ol>
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
