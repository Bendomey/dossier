import { useEffect, useRef, useState } from 'react'
import {
	useFetcher,
	useLoaderData,
	useLocation,
	useNavigate,
	useRevalidator,
} from 'react-router'
import { documentStatus, pendingVersionLabel } from './access'
import { UploadDialog } from './upload-dialog'
import { uploadFile } from './upload-file'
import { useIndexingPoll } from './use-indexing-poll'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
} from '~/components/arc/dialog/dialog'
import { Drawer, DrawerContent } from '~/components/arc/drawer/drawer'
import { LANGUAGE_NAMES, formatMonth, fromNow } from '~/lib/format'
import { cn } from '~/lib/utils'
import { useAppBase } from '~/providers/app-base-provider'
import type { DocumentActionResult } from '~/routes/_auth.knowledge.$documentId'

const CLOSE_ANIMATION_MS = 250

export function RetryButton({
	documentId,
	versionId,
	label = 'Retry',
}: {
	documentId: string
	versionId: string
	label?: string
}) {
	const fetcher = useFetcher<DocumentActionResult>({
		key: `retry:${versionId}`,
	})
	const { path } = useAppBase()
	return (
		<fetcher.Form
			method="post"
			action={path(`/knowledge/${documentId}`)}
			className="inline-flex flex-col gap-1"
		>
			<input type="hidden" name="intent" value="retry" />
			<input type="hidden" name="version_id" value={versionId} />
			<Button
				type="submit"
				size="sm"
				variant="secondary"
				loading={fetcher.state !== 'idle'}
			>
				{label}
			</Button>
			{fetcher.state === 'idle' && fetcher.data?.error ? (
				<span role="alert" className="text-danger text-xs">
					{fetcher.data.error}
				</span>
			) : null}
		</fetcher.Form>
	)
}

function versionLabel(version: DocumentVersionDetail) {
	if (version.is_current) return 'Current · Ready'
	switch (version.status) {
		case 'READY':
			return 'Ready'
		case 'PROCESSING':
			return `Processing ${version.progress}%`
		case 'QUEUED':
			return 'Queued'
		case 'FAILED':
			return 'Failed'
	}
}

export function DocumentWorkspaceDrawerModule() {
	const detail = useLoaderData() as DocumentDetail
	const { document, versions } = detail
	const navigate = useNavigate()
	const location = useLocation()
	const { path } = useAppBase()
	const { revalidate } = useRevalidator()
	const [open, setOpen] = useState(true)
	const [uploadOpen, setUploadOpen] = useState(false)
	const remover = useFetcher<DocumentActionResult>({
		key: `remove:${document.id}`,
	})
	const status = documentStatus(document)

	// The list's poll already covers the newest version; older ones are invisible to it.
	useIndexingPoll(
		versions
			.slice(1)
			.some(
				(version) =>
					version.status === 'QUEUED' || version.status === 'PROCESSING',
			),
	)

	const closing = useRef(false)
	const closeRef = useRef<() => void>(() => {})
	closeRef.current = () => {
		if (closing.current) return
		closing.current = true
		setOpen(false)
		setTimeout(
			() =>
				navigate(
					{ pathname: path('/knowledge'), search: location.search },
					{ preventScrollReset: true },
				),
			CLOSE_ANIMATION_MS,
		)
	}

	const removed = remover.state === 'idle' && remover.data?.ok === true
	useEffect(() => {
		if (removed) closeRef.current()
	}, [removed])

	function askAbout() {
		const draft = encodeURIComponent(`In ${document.name}, `)
		void navigate(`${path('/')}?mode=ASK&draft=${draft}`)
	}

	return (
		<Drawer
			open={open}
			onOpenChange={(next) => (next ? setOpen(true) : closeRef.current())}
		>
			<DrawerContent title={document.name}>
				<div className="flex flex-col gap-6">
					<span
						className={cn(
							'-mt-2 flex items-center gap-1.5 text-[13px]',
							status.tone,
						)}
					>
						<span className="size-1.5 rounded-full bg-current" />
						{status.label}
						{document.pending_version ? (
							<span className="text-secondary">
								· v{document.pending_version.version_number}{' '}
								{pendingVersionLabel(document.pending_version)}
							</span>
						) : null}
					</span>

					{document.status === 'FAILED' && document.error ? (
						<Alert tone="danger" title="Justo couldn’t index this file">
							{document.error}
						</Alert>
					) : null}

					<div className="flex gap-2">
						<Button
							className="flex-1"
							onClick={askAbout}
							disabled={document.status !== 'READY'}
						>
							Ask about this document
						</Button>
						{detail.can_upload_version ? (
							<Button variant="secondary" onClick={() => setUploadOpen(true)}>
								Upload new version
							</Button>
						) : null}
					</div>

					<dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm">
						<dt className="text-secondary">Collection</dt>
						<dd>{detail.collection_name}</dd>
						<dt className="text-secondary">Language</dt>
						<dd>{LANGUAGE_NAMES[document.language]}</dd>
						<dt className="text-secondary">Pages</dt>
						<dd className="tabular-nums">{document.pages || '–'}</dd>
						<dt className="text-secondary">Uploaded by</dt>
						<dd>{document.uploaded_by}</dd>
					</dl>

					<section className="flex flex-col gap-2.5">
						<h3 className="text-sm font-medium">Versions</h3>
						<ol className="flex flex-col">
							{versions.map((version) => (
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
									<div className="flex min-w-0 flex-col gap-0.5">
										<span className="truncate text-sm">
											v{version.version_number} · {version.file_name}
										</span>
										<span
											className={cn(
												'text-xs',
												version.status === 'FAILED'
													? 'text-danger'
													: 'text-muted',
											)}
										>
											{versionLabel(version)}
											{version.page_count
												? ` · ${version.page_count} pp`
												: ''}{' '}
											· {version.uploaded_by}
										</span>
										{version.error ? (
											<span className="text-secondary text-xs">
												{version.error}
											</span>
										) : null}
										{version.can_retry ? (
											<RetryButton
												documentId={document.id}
												versionId={version.id}
											/>
										) : null}
									</div>
									<span className="flex flex-col items-end gap-1">
										<span className="text-muted text-xs">
											{version.is_current
												? fromNow(version.created_at)
												: formatMonth(version.created_at)}
										</span>
										<a
											href={path(
												`/api/documents/${document.id}/versions/${version.id}/download`,
											)}
											className="text-accent text-xs hover:underline"
										>
											Download
										</a>
									</span>
								</li>
							))}
						</ol>
					</section>

					{detail.can_remove ? (
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="danger" className="self-start">
									Remove from knowledge
								</Button>
							</DialogTrigger>
							<DialogContent
								title="Remove from knowledge?"
								description={`Justo will stop answering from ${document.name}.`}
							>
								<remover.Form method="post" className="flex flex-col gap-3">
									<input type="hidden" name="intent" value="remove" />
									{remover.state === 'idle' && remover.data?.error ? (
										<span role="alert" className="text-danger text-sm">
											{remover.data.error}
										</span>
									) : null}
									<div className="flex justify-end gap-2">
										<DialogClose asChild>
											<Button type="button" variant="secondary">
												Cancel
											</Button>
										</DialogClose>
										<Button
											type="submit"
											variant="danger"
											loading={remover.state !== 'idle'}
										>
											Remove
										</Button>
									</div>
								</remover.Form>
							</DialogContent>
						</Dialog>
					) : null}
				</div>

				<UploadDialog
					open={uploadOpen}
					onOpenChange={setUploadOpen}
					collections={[]}
					fixedDocument={{
						id: document.id,
						name: document.name,
						collectionId: document.collection_id,
					}}
					upload={async (file, collectionId, options) => {
						await uploadFile(
							file,
							{
								url: path('/api/uploads'),
								collectionId,
								documentId: document.id,
							},
							options,
						)
					}}
					onUploaded={() => void revalidate()}
				/>
			</DrawerContent>
		</Drawer>
	)
}
