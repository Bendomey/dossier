import { FileSearch, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet, useParams, useSearchParams } from 'react-router'
import { documentStatus, effectiveGroupIds, groupNames } from './access'
import { CollectionIcon } from './collection-icon'
import { UploadDialog } from './upload-dialog'
import { useGetCollections } from '~/api/collections'
import { useGetDocuments, useGetKnowledgeStats } from '~/api/documents'
import { useGetGroups } from '~/api/groups'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import { SearchField } from '~/components/arc/search-field/search-field'
import SegmentedControl from '~/components/arc/segmented-control/segmented-control'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { Tooltip } from '~/components/arc/tooltip/tooltip'
import { fromNow } from '~/lib/format'
import { cn } from '~/lib/utils'
import { useAppBase } from '~/providers/app-base-provider'

function Stats() {
	const { data: stats } = useGetKnowledgeStats()
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

export function KnowledgeModule() {
	const [searchParams, setSearchParams] = useSearchParams()
	const { documentId } = useParams()
	const [uploadOpen, setUploadOpen] = useState(false)
	const { path } = useAppBase()

	const collectionId = searchParams.get('collection') ?? undefined
	const view = searchParams.get('view') === 'templates' ? 'templates' : 'all'
	const query = searchParams.get('q') ?? ''

	const { data: collections } = useGetCollections()
	const { data: groups } = useGetGroups()
	const { data: documents, isPending } = useGetDocuments({
		collection_id: collectionId,
		templates_only: view === 'templates',
		query,
	})

	function updateParam(key: string, value?: string) {
		setSearchParams(
			(params) => {
				if (value) params.set(key, value)
				else params.delete(key)
				return params
			},
			{ replace: true, preventScrollReset: true },
		)
	}

	const search = searchParams.toString()

	return (
		<div className="flex-1 overflow-auto px-4 pt-8 pb-16 md:px-10">
			<div className="animate-in fade-in slide-in-from-bottom-1.5 mx-auto flex max-w-[1120px] flex-col gap-6 duration-350">
				<div className="flex flex-wrap items-end gap-4">
					<div className="flex min-w-60 flex-1 flex-col gap-1.5">
						<h1 className="font-heading text-[32px] leading-[1.1] font-medium tracking-[-0.03em]">
							Company knowledge
						</h1>
						<p className="text-secondary text-[15px]">
							The documents and templates Dossier answers from. People only see
							what their access allows.
						</p>
					</div>
					<div className="flex gap-2">
						<Tooltip content="Collections are coming soon">
							<Button variant="secondary" aria-disabled="true">
								New collection
							</Button>
						</Tooltip>
						<Button onClick={() => setUploadOpen(true)}>
							<Upload className="size-4" strokeWidth={1.75} />
							Upload
						</Button>
					</div>
				</div>

				<Stats />

				<section
					aria-labelledby="collections-heading"
					className="flex flex-col gap-3"
				>
					<h2 id="collections-heading" className="text-[15px] font-medium">
						Collections
					</h2>
					<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2.5">
						{collections?.map((collection) => {
							const active = collection.id === collectionId
							return (
								<button
									key={collection.id}
									type="button"
									aria-pressed={active}
									onClick={() =>
										updateParam(
											'collection',
											active ? undefined : collection.id,
										)
									}
									className={cn(
										'flex cursor-pointer items-center gap-3 rounded-[22px] border px-4 py-3.5 text-left transition-colors',
										active
											? 'border-accent bg-accent-subtle'
											: 'bg-surface hover:border-border-strong',
									)}
								>
									<CollectionIcon
										icon={collection.icon}
										className={cn(
											'size-5 shrink-0',
											active ? 'text-accent' : 'text-secondary',
										)}
									/>
									<span className="flex min-w-0 flex-1 flex-col">
										<span className="text-sm font-medium">
											{collection.name}
										</span>
										<span className="text-secondary truncate text-[13px]">
											{collection.document_count} documents
											{groups
												? ` · ${groupNames(collection.group_ids, groups)}`
												: ''}
										</span>
									</span>
								</button>
							)
						}) ?? <Skeleton lines={2} label="Loading collections" />}
					</div>
				</section>

				<div className="flex flex-wrap items-end gap-3">
					<SegmentedControl
						label="Document type"
						value={view}
						onValueChange={(value) =>
							updateParam('view', value === 'templates' ? value : undefined)
						}
						options={[
							{ value: 'all', label: 'All documents' },
							{ value: 'templates', label: 'Templates' },
						]}
					/>
					<div className="min-w-[200px] flex-1">
						<SearchField
							label="Search documents"
							placeholder="Search documents and templates"
							value={query}
							onValueChange={(value) => updateParam('q', value || undefined)}
						/>
					</div>
				</div>

				<div className="overflow-hidden rounded-[26px] border">
					<div className="bg-surface-muted text-secondary desk:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,.7fr)_minmax(0,1.1fr)_minmax(0,1fr)] grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-3 text-xs">
						<span>Name</span>
						<span className="desk:block hidden">Collection</span>
						<span className="desk:block hidden">Language</span>
						<span className="desk:block hidden">Access</span>
						<span>Status</span>
					</div>
					{isPending ? (
						<div className="p-5">
							<Skeleton lines={5} label="Loading documents" />
						</div>
					) : documents?.length ? (
						<ul>
							{documents.map((document) => {
								const status = documentStatus(document)
								const collection = collections?.find(
									(item) => item.id === document.collection_id,
								)
								return (
									<li key={document.id}>
										<Link
											to={{
												pathname: path(`/knowledge/${document.id}`),
												search,
											}}
											preventScrollReset
											className={cn(
												'border-border-subtle hover:bg-surface-muted desk:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,.7fr)_minmax(0,1.1fr)_minmax(0,1fr)] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t px-5 py-3 text-sm transition-colors',
												documentId === document.id && 'bg-surface-muted',
											)}
										>
											<span className="flex min-w-0 items-center gap-3">
												<span className="text-secondary grid h-10 w-[34px] shrink-0 place-items-end justify-center rounded-[7px] border pb-[5px] font-mono text-[8px]">
													{document.file_type}
												</span>
												<span className="flex min-w-0 flex-col">
													<span className="truncate">{document.name}</span>
													<span className="text-muted text-xs">
														{document.file_type} · {document.pages} pages ·{' '}
														{fromNow(document.updated_at)}
													</span>
												</span>
											</span>
											<span className="text-secondary desk:block hidden text-[13px]">
												{collection?.name}
											</span>
											<span className="text-secondary desk:block hidden font-mono text-[13px]">
												{document.language}
											</span>
											<span className="text-secondary desk:block hidden text-[13px]">
												{groupNames(
													effectiveGroupIds(document, collections),
													groups,
												)}
												{document.group_ids ? ' (custom)' : ''}
											</span>
											<span className="flex flex-col gap-1.5">
												<span
													className={cn(
														'flex items-center gap-1.5 text-[13px]',
														status.tone,
													)}
												>
													<span className="size-1.5 rounded-full bg-current" />
													{status.label}
												</span>
												{document.status === 'PROCESSING' ? (
													<span className="bg-border h-[3px] max-w-[120px] overflow-hidden rounded-full">
														<span
															className="bg-accent block h-full transition-[width] duration-500"
															style={{ width: `${document.progress}%` }}
														/>
													</span>
												) : null}
											</span>
										</Link>
									</li>
								)
							})}
						</ul>
					) : (
						<EmptyState
							icon={<FileSearch size={24} />}
							title="No documents match"
							description="Try another search or collection."
						/>
					)}
				</div>
			</div>

			<UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
			<Outlet />
		</div>
	)
}
