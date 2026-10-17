import { Download, RotateCcw, Square } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '~/components/arc/button/button'
import { CopyButton } from '~/components/arc/copy-button/copy-button'
import { TextShimmer } from '~/components/arc/text-shimmer/text-shimmer'
import { LogoMark } from '~/components/layout/logo'
import { cn } from '~/lib/utils'
import { useAppBase } from '~/providers/app-base-provider'

export function UserMessage({ text }: { text: string }) {
	return (
		<div className="bg-surface-muted animate-in fade-in slide-in-from-bottom-1.5 max-w-[min(560px,90%)] self-end rounded-[22px] px-4 py-3 text-[15px] leading-[1.55] whitespace-pre-wrap duration-350">
			{text}
		</div>
	)
}

/** Renders citation markers such as [1] in the accent colour. */
function CitedText({ text }: { text: string }) {
	const parts = text.split(/(\[[0-9A-Z]+\])/g)
	return (
		<>
			{parts.map((part, index) =>
				/^\[[0-9A-Z]+\]$/.test(part) ? (
					<span key={index} className="text-accent">
						{part}
					</span>
				) : (
					part
				),
			)}
		</>
	)
}

const SEVERITY: Record<
	ReviewFinding['severity'],
	{ label: string; className: string }
> = {
	HIGH: { label: 'High', className: 'text-danger bg-danger/12' },
	MEDIUM: { label: 'Medium', className: 'text-warning bg-warning/12' },
	LOW: { label: 'Low', className: 'text-secondary bg-secondary/12' },
}

function Findings({ findings }: { findings: ReviewFinding[] }) {
	return (
		<div className="flex flex-col overflow-hidden rounded-[22px] border">
			{findings.map((finding, index) => (
				<div
					key={finding.clause}
					style={{ animationDelay: `${index * 90}ms` }}
					className="border-border-subtle animate-in fade-in slide-in-from-bottom-1.5 fill-mode-both flex flex-col gap-1.5 border-t px-[18px] py-4 duration-350 first:border-t-0"
				>
					<div className="flex flex-wrap items-center gap-2.5">
						<span
							className={cn(
								'flex h-[22px] items-center gap-1.5 rounded-full px-2 text-xs',
								SEVERITY[finding.severity].className,
							)}
						>
							<span className="size-1.5 rounded-full bg-current" />
							{SEVERITY[finding.severity].label}
						</span>
						<span className="text-sm font-medium">{finding.clause}</span>
					</div>
					<span className="text-sm leading-[1.55]">{finding.text}</span>
					<span className="text-muted text-xs">{finding.source}</span>
				</div>
			))}
		</div>
	)
}

function Changes({ changes }: { changes: DocumentChange[] }) {
	return (
		<div className="flex flex-col gap-2.5">
			{changes.map((change) => (
				<div
					key={change.added}
					className="animate-in fade-in slide-in-from-bottom-1.5 flex flex-col gap-1.5 rounded-[22px] border px-4 py-3.5 duration-350"
				>
					<del className="text-danger font-mono text-[13px]">
						{change.removed}
					</del>
					<ins className="text-success font-mono text-[13px] no-underline">
						{change.added}
					</ins>
					<span className="text-muted text-xs">{change.note}</span>
				</div>
			))}
		</div>
	)
}

function DraftCard({ draft }: { draft: DraftAttachment }) {
	return (
		<div className="animate-in fade-in zoom-in-[.97] flex flex-wrap items-center gap-3.5 rounded-[22px] border p-3.5 duration-300">
			<span
				aria-hidden="true"
				className="border-border-strong bg-surface flex h-[52px] w-11 shrink-0 flex-col gap-1 rounded-lg border px-2 py-2.5"
			>
				{['w-full', 'w-[70%]', 'w-full', 'w-1/2'].map((width, index) => (
					<span key={index} className={cn('bg-border-strong h-0.5', width)} />
				))}
			</span>
			<span className="flex min-w-40 flex-1 flex-col gap-0.5">
				<span className="text-sm font-medium">{draft.title}</span>
				<span className="text-secondary text-[13px]">{draft.meta}</span>
			</span>
			<Button variant="secondary" size="sm">
				Open
			</Button>
			<Button size="sm">Export DOCX</Button>
		</div>
	)
}

function Sources({ sources }: { sources: ChatSource[] }) {
	return (
		<div className="flex flex-wrap gap-2">
			{sources.map((source) => (
				<button
					key={source.key}
					type="button"
					className="bg-surface hover:border-border-strong animate-in fade-in zoom-in-95 flex h-8 cursor-pointer items-center gap-2 rounded-[14px] border px-3 text-[13px] duration-250"
				>
					<span className="text-accent font-mono text-xs">{source.key}</span>
					{source.title}
				</button>
			))}
		</div>
	)
}

const actionClass =
	'text-muted hover:bg-surface-muted hover:text-foreground flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] px-2 text-xs'

const chipClass =
	'bg-surface animate-in fade-in zoom-in-95 flex h-8 max-w-full items-center gap-2 self-start rounded-[14px] border px-3 text-[13px] duration-250'

function pagesOf(citation: Citation) {
	if (citation.page === null) return null
	return citation.page_end && citation.page_end !== citation.page
		? `p. ${citation.page}–${citation.page_end}`
		: `p. ${citation.page}`
}

function Citations({ citations }: { citations: Citation[] }) {
	const { path } = useAppBase()
	return (
		<div className="flex flex-col gap-1.5">
			{citations.map((citation) => {
				const detail = [
					citation.version_number && `v${citation.version_number}`,
					pagesOf(citation),
					citation.section,
				]
					.filter(Boolean)
					.join(' · ')
				const label = (
					<>
						<span className="text-accent font-mono text-xs">
							[{citation.order}]
						</span>
						<span className="truncate">
							{citation.available
								? citation.document_name
								: 'No longer available'}
						</span>
						{detail ? (
							<span className="text-muted shrink-0">{detail}</span>
						) : null}
					</>
				)
				return citation.available ? (
					<Link
						key={citation.order}
						to={path(`/knowledge/${citation.document_id}`)}
						className={cn(chipClass, 'hover:border-border-strong')}
					>
						{label}
					</Link>
				) : (
					<span key={citation.order} className={cn(chipClass, 'text-muted')}>
						{label}
					</span>
				)
			})}
		</div>
	)
}

const STOPPED_TEXT: Record<string, string> = {
	CANCELLED: 'You stopped this answer.',
	AI_DISABLED: 'AI isn’t configured for this workspace yet.',
	PROVIDER_BLOCKED: 'The AI provider declined to answer this.',
	STALLED: 'This answer stopped before it finished.',
	CONNECTION_LOST: 'Lost the connection to this answer.',
}

function StoppedNotice({
	message,
	onRetry,
}: {
	message: ChatMessage
	onRetry?: () => void
}) {
	const code = message.error?.code ?? message.status ?? ''
	const retryable =
		message.status === 'CANCELLED' || message.error?.retryable === true
	return (
		<div className="text-secondary -ml-2 flex flex-wrap items-center gap-1 text-sm">
			<span className="px-2">
				{STOPPED_TEXT[code] ?? 'Something went wrong while answering.'}
			</span>
			{retryable && onRetry ? (
				<button type="button" className={actionClass} onClick={onRetry}>
					<RotateCcw className="size-3.5" strokeWidth={1.75} />
					Retry
				</button>
			) : null}
		</div>
	)
}

export function AssistantMessage({
	message,
	onRetry,
	onStop,
}: {
	message: ChatMessage
	onRetry?: () => void
	onStop?: () => void
}) {
	const done = message.status === 'DONE'
	const stopped = message.status === 'FAILED' || message.status === 'CANCELLED'
	const thinking = !done && !stopped && !message.text

	return (
		<div className="animate-in fade-in slide-in-from-bottom-1.5 flex items-start gap-3.5 duration-350">
			<LogoMark className="mt-0.5 size-7 rounded-lg" />
			<div className="flex min-w-0 flex-1 flex-col gap-3.5">
				{thinking ? (
					<TextShimmer className="pt-1 text-[15px]">
						{`${message.status_label ?? 'Thinking'}…`}
					</TextShimmer>
				) : null}
				{message.text ? (
					<div
						className={cn(
							'text-[15px] leading-[1.7] whitespace-pre-wrap',
							stopped && 'text-secondary',
						)}
						aria-live="polite"
					>
						<CitedText text={message.text} />
					</div>
				) : null}
				{done && message.unsupported ? (
					<span className="text-warning bg-warning/12 self-start rounded-full px-2.5 py-1 text-xs">
						No source cited: check before relying on this
					</span>
				) : null}
				{done && message.findings ? (
					<Findings findings={message.findings} />
				) : null}
				{done && message.changes ? <Changes changes={message.changes} /> : null}
				{done && message.draft ? <DraftCard draft={message.draft} /> : null}
				{done && message.sources ? <Sources sources={message.sources} /> : null}
				{done && message.citations?.length ? (
					<Citations citations={message.citations} />
				) : null}
				{stopped ? <StoppedNotice message={message} onRetry={onRetry} /> : null}
				{!done && !stopped && onStop ? (
					<button
						type="button"
						className={cn(actionClass, '-ml-2 self-start')}
						onClick={onStop}
					>
						<Square className="size-3.5" strokeWidth={1.75} />
						Stop
					</button>
				) : null}
				{done ? (
					<div className="animate-in fade-in -ml-2 flex items-center gap-0.5 duration-300">
						<CopyButton value={message.text} variant="plain" />
						<button type="button" className={actionClass}>
							<Download className="size-3.5" strokeWidth={1.75} />
							Export
						</button>
						{onRetry ? (
							<button type="button" className={actionClass} onClick={onRetry}>
								<RotateCcw className="size-3.5" strokeWidth={1.75} />
								Retry
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	)
}
