import { FileSearch, FolderPlus, Pencil, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher, useLoaderData, useSearchParams } from 'react-router'
import { documentStatus, effectiveGroupIds, groupNames } from './access'
import { CollectionIcon } from './collection-icon'
import { StatsGrid } from './stats-grid'
import { Button } from '~/components/arc/button/button'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
} from '~/components/arc/drawer/drawer'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import { Input } from '~/components/arc/input/input'
import { SearchField } from '~/components/arc/search-field/search-field'
import SegmentedControl from '~/components/arc/segmented-control/segmented-control'
import { Tooltip } from '~/components/arc/tooltip/tooltip'
import { ToggleChip } from '~/components/toggle-chip'
import { fromNow, plural } from '~/lib/format'
import { cn } from '~/lib/utils'
import { useSession } from '~/providers/session-provider'
import type { KnowledgeActionResult } from '~/routes/_auth.knowledge'

const ICON_CHOICES: Array<{ icon: CollectionIconName; label: string }> = [
	{ icon: 'scale', label: 'Legal' },
	{ icon: 'people', label: 'People' },
	{ icon: 'building', label: 'Company' },
	{ icon: 'briefcase', label: 'Operations' },
]

type Editing = { mode: 'new' } | { mode: 'edit'; collection: Collection }

function DeleteCollection({
	collection,
	onDeleted,
}: {
	collection: Collection
	onDeleted: () => void
}) {
	const fetcher = useFetcher<KnowledgeActionResult>({
		key: `collection-delete:${collection.id}`,
	})
	const [confirming, setConfirming] = useState(false)

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data?.ok) onDeleted()
	}, [fetcher.state, fetcher.data, onDeleted])

	if (!confirming) {
		return (
			<Button
				type="button"
				variant="danger"
				className="self-start"
				onClick={() => setConfirming(true)}
			>
				Delete collection
			</Button>
		)
	}
	return (
		<fetcher.Form
			method="post"
			className="border-border-subtle flex flex-col gap-3 rounded-[20px] border p-4"
		>
			<input type="hidden" name="intent" value="delete" />
			<input type="hidden" name="collection_id" value={collection.id} />
			<p className="text-sm">
				Delete {collection.name}? This can’t be undone.
				{collection.document_count
					? ` It still has ${plural(collection.document_count, 'document')}, which must be moved or deleted first.`
					: ''}
			</p>
			{fetcher.state === 'idle' && fetcher.data?.error ? (
				<p role="alert" className="text-danger text-[13px]">
					{fetcher.data.error}
				</p>
			) : null}
			<div className="flex gap-2">
				<Button
					type="button"
					variant="secondary"
					onClick={() => setConfirming(false)}
				>
					Keep it
				</Button>
				<Button
					type="submit"
					variant="danger"
					loading={fetcher.state !== 'idle'}
				>
					Delete
				</Button>
			</div>
		</fetcher.Form>
	)
}

function CollectionSheet({
	editing,
	onClose,
	onDeleted,
}: {
	editing: Editing | null
	onClose: () => void
	onDeleted: (collectionId: string) => void
}) {
	const { groups } = useLoaderData() as KnowledgeOverview
	const fetcher = useFetcher<KnowledgeActionResult>({ key: 'collection-save' })
	const [attempt, setAttempt] = useState(0)
	const [submittedIn, setSubmittedIn] = useState(-1)
	const collection = editing?.mode === 'edit' ? editing.collection : null
	const everyoneId = groups.find((group) => group.is_builtin)?.id
	const [icon, setIcon] = useState<CollectionIconName>('briefcase')
	const [groupIds, setGroupIds] = useState<string[]>([])

	useEffect(() => {
		if (!editing) return
		setAttempt((count) => count + 1)
		setIcon(collection?.icon ?? 'briefcase')
		setGroupIds(collection?.group_ids ?? (everyoneId ? [everyoneId] : []))
	}, [editing, collection, everyoneId])

	const saving = fetcher.state !== 'idle'
	const error =
		submittedIn === attempt && fetcher.state === 'idle'
			? fetcher.data?.error
			: undefined

	useEffect(() => {
		if (
			submittedIn === attempt &&
			fetcher.state === 'idle' &&
			fetcher.data?.ok
		) {
			setSubmittedIn(-1)
			onClose()
		}
	}, [submittedIn, attempt, fetcher.state, fetcher.data, onClose])

	return (
		<Drawer open={Boolean(editing)} onOpenChange={(open) => !open && onClose()}>
			<DrawerContent
				side="bottom"
				title={collection ? `Edit ${collection.name}` : 'New collection'}
				description="Collections group documents and decide who can see them."
			>
				<fetcher.Form
					key={attempt}
					method="post"
					onSubmit={() => setSubmittedIn(attempt)}
					className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pb-2"
				>
					<input
						type="hidden"
						name="intent"
						value={collection ? 'update' : 'create'}
					/>
					{collection ? (
						<input type="hidden" name="collection_id" value={collection.id} />
					) : null}
					<Input
						label="Name"
						name="name"
						placeholder="Legal & contracts"
						defaultValue={collection?.name}
						maxLength={80}
						required
						autoFocus
						autoComplete="off"
						error={error}
					/>
					<Input
						label="Description (optional)"
						name="description"
						placeholder="Contracts, NDAs and supplier agreements"
						defaultValue={collection?.description ?? ''}
						maxLength={280}
						autoComplete="off"
					/>
					<fieldset className="flex flex-col gap-2">
						<legend className="text-secondary mb-2 text-[13px]">Icon</legend>
						<div className="flex flex-wrap gap-1.5">
							{ICON_CHOICES.map((choice) => (
								<button
									key={choice.icon}
									type="button"
									aria-pressed={icon === choice.icon}
									onClick={() => setIcon(choice.icon)}
									className={cn(
										'flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition-colors',
										icon === choice.icon
											? 'border-foreground bg-foreground text-background'
											: 'border-border bg-surface text-secondary hover:border-border-strong',
									)}
								>
									<CollectionIcon icon={choice.icon} className="size-4" />
									{choice.label}
								</button>
							))}
						</div>
						<input type="hidden" name="icon" value={icon} />
					</fieldset>
					<fieldset className="flex flex-col gap-2">
						<legend className="text-secondary mb-2 text-[13px]">
							Who can see it
						</legend>
						<div className="flex flex-wrap gap-1.5">
							{groups.map((group) => (
								<ToggleChip
									key={group.id}
									pressed={groupIds.includes(group.id)}
									onPressedChange={(pressed) =>
										setGroupIds((current) =>
											pressed
												? [...current, group.id]
												: current.filter((id) => id !== group.id),
										)
									}
								>
									{group.name}
								</ToggleChip>
							))}
						</div>
						<p className="text-muted text-[13px]">
							{groupIds.length
								? 'Owners and admins always see every collection.'
								: 'Only owners and admins will see it.'}
						</p>
						{groupIds.map((id) => (
							<input key={id} type="hidden" name="group_ids" value={id} />
						))}
					</fieldset>
					<div className="flex justify-end gap-2 pt-1">
						<DrawerClose asChild>
							<Button type="button" variant="secondary">
								Cancel
							</Button>
						</DrawerClose>
						<Button type="submit" loading={saving}>
							{collection ? 'Save changes' : 'Create collection'}
						</Button>
					</div>
				</fetcher.Form>
				{collection ? (
					<div className="mx-auto flex w-full max-w-[640px] flex-col pt-3 pb-2">
						<DeleteCollection
							key={collection.id}
							collection={collection}
							onDeleted={() => onDeleted(collection.id)}
						/>
					</div>
				) : null}
			</DrawerContent>
		</Drawer>
	)
}

function CollectionCard({
	collection,
	groups,
	active,
	onSelect,
	onEdit,
}: {
	collection: Collection
	groups: Group[]
	active: boolean
	onSelect: () => void
	onEdit?: () => void
}) {
	return (
		<div
			className={cn(
				'flex items-center gap-1 rounded-[22px] border transition-colors',
				active
					? 'border-accent bg-accent-subtle'
					: 'bg-surface hover:border-border-strong',
			)}
		>
			<button
				type="button"
				aria-pressed={active}
				onClick={onSelect}
				className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3.5 pl-4 text-left"
			>
				<CollectionIcon
					icon={collection.icon}
					className={cn(
						'size-5 shrink-0',
						active ? 'text-accent' : 'text-secondary',
					)}
				/>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-medium">
						{collection.name}
					</span>
					<span className="text-secondary truncate text-[13px]">
						{plural(collection.document_count, 'document')} ·{' '}
						{groupNames(collection.group_ids, groups)}
					</span>
				</span>
			</button>
			{onEdit ? (
				<Tooltip content={`Edit ${collection.name}`}>
					<button
						type="button"
						aria-label={`Edit ${collection.name}`}
						onClick={onEdit}
						className="text-muted hover:bg-surface-muted hover:text-foreground mr-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-[12px]"
					>
						<Pencil className="size-4" strokeWidth={1.75} />
					</button>
				</Tooltip>
			) : null}
		</div>
	)
}

/** Knowledge for a real workspace: collections and documents from the database. */
export function KnowledgeModule() {
	const { collections, documents, stats, groups } =
		useLoaderData() as KnowledgeOverview
	const { can } = useSession()
	const [searchParams, setSearchParams] = useSearchParams()
	const [editing, setEditing] = useState<Editing | null>(null)
	const canManage = can('collections.manage')

	const collectionId = searchParams.get('collection') ?? undefined
	const view = searchParams.get('view') === 'templates' ? 'templates' : 'all'
	const [query, setQuery] = useState(searchParams.get('q') ?? '')
	const filtering = Boolean(collectionId || view === 'templates' || query)

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

	useEffect(() => {
		const timer = setTimeout(() => {
			if ((searchParams.get('q') ?? '') !== query) {
				updateParam('q', query || undefined)
			}
		}, 250)
		return () => clearTimeout(timer)
	})

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
						{canManage ? (
							<Button
								variant="secondary"
								onClick={() => setEditing({ mode: 'new' })}
							>
								New collection
							</Button>
						) : null}
						<Tooltip content="Uploading documents is coming soon">
							<Button aria-disabled="true">
								<Upload className="size-4" strokeWidth={1.75} />
								Upload
							</Button>
						</Tooltip>
					</div>
				</div>

				<StatsGrid stats={stats} />

				<section
					aria-labelledby="collections-heading"
					className="flex flex-col gap-3"
				>
					<h2 id="collections-heading" className="text-[15px] font-medium">
						Collections
					</h2>
					{collections.length ? (
						<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2.5">
							{collections.map((collection) => {
								const active = collection.id === collectionId
								return (
									<CollectionCard
										key={collection.id}
										collection={collection}
										groups={groups}
										active={active}
										onSelect={() =>
											updateParam(
												'collection',
												active ? undefined : collection.id,
											)
										}
										onEdit={
											canManage
												? () => setEditing({ mode: 'edit', collection })
												: undefined
										}
									/>
								)
							})}
						</div>
					) : (
						<div className="rounded-[26px] border">
							<EmptyState
								icon={<FolderPlus size={24} />}
								title={
									canManage
										? 'Start with a collection'
										: 'Nothing shared with you yet'
								}
								description={
									canManage
										? 'Collections group documents, like Legal & contracts or HR policies, and decide which groups can see them.'
										: 'Collections your groups can see will appear here.'
								}
								action={
									canManage ? (
										<Button onClick={() => setEditing({ mode: 'new' })}>
											New collection
										</Button>
									) : undefined
								}
							/>
						</div>
					)}
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
							onValueChange={setQuery}
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
					{documents.length ? (
						<ul>
							{documents.map((document) => {
								const status = documentStatus(document)
								return (
									<li
										key={document.id}
										className="border-border-subtle desk:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,.7fr)_minmax(0,1.1fr)_minmax(0,1fr)] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t px-5 py-3 text-sm"
									>
										<span className="flex min-w-0 items-center gap-3">
											<span className="text-secondary grid h-10 w-[34px] shrink-0 place-items-end justify-center rounded-[7px] border pb-[5px] font-mono text-[8px]">
												{document.file_type}
											</span>
											<span className="flex min-w-0 flex-col">
												<span className="truncate">{document.name}</span>
												<span className="text-muted text-xs">
													{document.file_type} · {fromNow(document.updated_at)}
												</span>
											</span>
										</span>
										<span className="text-secondary desk:block hidden text-[13px]">
											{
												collections.find(
													(item) => item.id === document.collection_id,
												)?.name
											}
										</span>
										<span className="text-secondary desk:block hidden font-mono text-[13px]">
											{document.language}
										</span>
										<span className="text-secondary desk:block hidden text-[13px]">
											{groupNames(
												effectiveGroupIds(document, collections),
												groups,
											)}
										</span>
										<span
											className={cn(
												'flex items-center gap-1.5 text-[13px]',
												status.tone,
											)}
										>
											<span className="size-1.5 rounded-full bg-current" />
											{status.label}
										</span>
									</li>
								)
							})}
						</ul>
					) : (
						<EmptyState
							icon={<FileSearch size={24} />}
							title={filtering ? 'No documents match' : 'No documents yet'}
							description={
								filtering
									? 'Try another search or collection.'
									: 'Uploading documents is coming soon. Collections you set up now will be ready for them.'
							}
						/>
					)}
				</div>
			</div>

			<CollectionSheet
				editing={editing}
				onClose={() => setEditing(null)}
				onDeleted={(deletedId) => {
					setEditing(null)
					if (deletedId === collectionId) updateParam('collection')
				}}
			/>
		</div>
	)
}
