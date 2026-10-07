import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { documentStatus, effectiveGroupIds, groupNames } from './access'
import { useGetCollections } from '~/api/collections'
import {
	useGetDocument,
	useGetDocumentVersions,
	useRemoveDocument,
	useSetDocumentAccess,
} from '~/api/documents'
import { useGetGroups } from '~/api/groups'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
} from '~/components/arc/dialog/dialog'
import { Drawer, DrawerContent } from '~/components/arc/drawer/drawer'
import { RadioGroup } from '~/components/arc/radio-group/radio-group'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { ToggleChip } from '~/components/toggle-chip'
import { LANGUAGE_NAMES, formatMonth, fromNow } from '~/lib/format'
import { cn } from '~/lib/utils'

const CLOSE_ANIMATION_MS = 250

export function DocumentDrawerModule() {
	const { documentId = '' } = useParams()
	const navigate = useNavigate()
	const location = useLocation()
	const [open, setOpen] = useState(true)

	const { data: document, isError, error } = useGetDocument(documentId)

	function close() {
		setOpen(false)
		setTimeout(
			() =>
				navigate(
					{ pathname: '/knowledge', search: location.search },
					{ preventScrollReset: true },
				),
			CLOSE_ANIMATION_MS,
		)
	}

	return (
		<Drawer
			open={open}
			onOpenChange={(next) => (next ? setOpen(true) : close())}
		>
			<DrawerContent title={document?.name ?? 'Document'}>
				{isError ? (
					<Alert tone="danger" title="This document isn’t available">
						{error.message}
					</Alert>
				) : document ? (
					<DocumentDetails document={document} onRemoved={close} />
				) : (
					<Skeleton lines={6} label="Loading document" />
				)}
			</DrawerContent>
		</Drawer>
	)
}

function DocumentDetails({
	document,
	onRemoved,
}: {
	document: DossierDocument
	onRemoved: () => void
}) {
	const navigate = useNavigate()
	const { data: collections } = useGetCollections()
	const { data: groups } = useGetGroups()
	const { data: versions } = useGetDocumentVersions(document.id)
	const setAccess = useSetDocumentAccess()
	const removeDocument = useRemoveDocument()

	const status = documentStatus(document)
	const collection = collections?.find(
		(item) => item.id === document.collection_id,
	)
	const effective = effectiveGroupIds(document, collections)
	const custom = document.group_ids !== null

	function toggleGroup(groupId: string) {
		const current = document.group_ids ?? effective
		setAccess.mutate({
			documentId: document.id,
			groupIds: current.includes(groupId)
				? current.filter((item) => item !== groupId)
				: [...current, groupId],
		})
	}

	function askAbout() {
		const draft = encodeURIComponent(`In ${document.name}, `)
		void navigate(`/?mode=ASK&draft=${draft}`)
	}

	return (
		<div className="flex flex-col gap-6">
			<span
				className={cn(
					'-mt-2 flex items-center gap-1.5 text-[13px]',
					status.tone,
				)}
			>
				<span className="size-1.5 rounded-full bg-current" />
				{status.label}
			</span>

			<div className="flex gap-2">
				<Button className="flex-1" onClick={askAbout}>
					Ask about this document
				</Button>
				<Button variant="secondary">Replace</Button>
			</div>

			<dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
				<dt className="text-secondary">Collection</dt>
				<dd>{collection?.name}</dd>
				<dt className="text-secondary">Language</dt>
				<dd>{LANGUAGE_NAMES[document.language]}</dd>
				<dt className="text-secondary">Pages</dt>
				<dd className="tabular-nums">{document.pages}</dd>
				<dt className="text-secondary">Uploaded by</dt>
				<dd>{document.uploaded_by}</dd>
				<dt className="text-secondary">Used in answers</dt>
				<dd className="tabular-nums">{document.answer_count}</dd>
			</dl>

			<section className="flex flex-col gap-2.5">
				<RadioGroup
					label="Who can see it"
					value={custom ? 'custom' : 'inherit'}
					onValueChange={(value) =>
						setAccess.mutate({
							documentId: document.id,
							groupIds: value === 'custom' ? [...effective] : null,
						})
					}
					options={[
						{
							value: 'inherit',
							label: 'Same as collection',
							description: groupNames(collection?.group_ids ?? [], groups),
						},
						{ value: 'custom', label: 'Choose groups' },
					]}
				/>
				{custom ? (
					<div className="animate-in fade-in slide-in-from-bottom-1 flex flex-wrap gap-1.5 duration-250">
						{groups?.map((group) => (
							<ToggleChip
								key={group.id}
								pressed={effective.includes(group.id)}
								onPressedChange={() => toggleGroup(group.id)}
							>
								{group.name}
							</ToggleChip>
						))}
					</div>
				) : null}
				<div className="flex items-center justify-between rounded-[18px] border px-3.5 py-3 text-sm">
					<span>Owners and admins</span>
					<span className="text-secondary text-[13px]">Always</span>
				</div>
				<p className="text-muted text-[13px]">
					Manage who is in each group in{' '}
					<Link to="/settings/groups" className="text-accent hover:underline">
						Settings, Groups
					</Link>
					.
				</p>
			</section>

			<section className="flex flex-col gap-2.5">
				<h3 className="text-sm font-medium">Versions</h3>
				<ol className="flex flex-col">
					{versions?.map((version) => (
						<li
							key={version.id}
							className="grid grid-cols-[14px_1fr_auto] items-start gap-3 py-2"
						>
							<span
								className={cn(
									'mt-[5px] size-[9px] rounded-full border-[1.5px]',
									version.is_current
										? 'border-accent bg-accent'
										: 'border-border-strong',
								)}
							/>
							<span className="flex flex-col">
								<span className="text-sm">{version.label}</span>
								<span className="text-muted text-xs">{version.note}</span>
							</span>
							<span className="text-muted text-xs">
								{version.is_current
									? fromNow(version.created_at)
									: formatMonth(version.created_at)}
							</span>
						</li>
					)) ?? <Skeleton lines={3} label="Loading versions" />}
				</ol>
			</section>

			<Dialog>
				<DialogTrigger asChild>
					<Button variant="danger" className="self-start">
						Remove from knowledge
					</Button>
				</DialogTrigger>
				<DialogContent
					title="Remove from knowledge?"
					description={`Dossier will stop answering from ${document.name}. Its versions are deleted too.`}
				>
					<div className="flex justify-end gap-2">
						<DialogClose asChild>
							<Button variant="secondary">Cancel</Button>
						</DialogClose>
						<Button
							variant="danger"
							loading={removeDocument.isPending}
							onClick={() =>
								removeDocument.mutate(document.id, { onSuccess: onRemoved })
							}
						>
							Remove
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}
