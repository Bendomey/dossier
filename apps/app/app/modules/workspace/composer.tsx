import { ArrowUp, Paperclip, X } from 'lucide-react'
import { useEffect, useRef, type RefObject } from 'react'
import { MODES } from './modes'
import { useGetCollections } from '~/api/collections'
import { Tooltip } from '~/components/arc/tooltip/tooltip'
import { cn } from '~/lib/utils'

interface Props {
	value: string
	onValueChange: (value: string) => void
	onSubmit: () => void
	placeholder: string
	variant: 'start' | 'follow-up'
	busy?: boolean
	mode?: ChatMode | null
	onClearMode?: () => void
	autoFocus?: boolean
	textareaRef?: RefObject<HTMLTextAreaElement | null>
}

const MAX_HEIGHT = 240

export function Composer({
	value,
	onValueChange,
	onSubmit,
	placeholder,
	variant,
	busy,
	mode,
	onClearMode,
	autoFocus,
	textareaRef: externalRef,
}: Props) {
	const internalRef = useRef<HTMLTextAreaElement>(null)
	const textareaRef = externalRef ?? internalRef
	const canSend = value.trim().length > 0 && !busy

	useEffect(() => {
		const textarea = textareaRef.current
		if (!textarea) return
		textarea.style.height = 'auto'
		textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_HEIGHT)}px`
	}, [value, textareaRef])

	function submit(event?: React.FormEvent) {
		event?.preventDefault()
		if (canSend) onSubmit()
	}

	const sendButton = (
		<button
			type="submit"
			aria-label="Send"
			disabled={!canSend}
			className={cn(
				'text-background grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition-[background-color,transform] active:scale-[.92] disabled:cursor-default',
				canSend ? 'bg-foreground' : 'bg-border-strong',
			)}
		>
			<ArrowUp className="size-4" strokeWidth={2} />
		</button>
	)

	const attachButton = (compact: boolean) => (
		<Tooltip content="Attachments are coming soon">
			<button
				type="button"
				aria-label="Attach"
				aria-disabled="true"
				className={cn(
					'text-secondary hover:bg-surface-muted hover:text-foreground flex h-8 cursor-not-allowed items-center gap-1.5 rounded-xl text-[13px]',
					compact ? 'w-9 justify-center' : 'px-2.5',
				)}
			>
				<Paperclip className="size-4" strokeWidth={1.75} />
				{compact ? null : 'Attach'}
			</button>
		</Tooltip>
	)

	const textarea = (
		<textarea
			ref={textareaRef}
			value={value}
			onChange={(event) => onValueChange(event.target.value)}
			onKeyDown={(event) => {
				if (
					event.key === 'Enter' &&
					!event.shiftKey &&
					!event.nativeEvent.isComposing
				) {
					submit(event)
				}
			}}
			rows={variant === 'start' ? 3 : 1}
			placeholder={placeholder}
			aria-label="Message"
			autoFocus={autoFocus}
			className={cn(
				'text-foreground w-full resize-none bg-transparent leading-normal outline-none',
				variant === 'start' ? 'py-1 text-base' : 'flex-1 py-[7px] text-[15px]',
			)}
		/>
	)

	if (variant === 'follow-up') {
		return (
			<form
				onSubmit={submit}
				className="border-border-strong bg-surface focus-within:border-foreground flex items-end gap-2 rounded-[26px] border py-2.5 pr-2.5 pl-[18px] transition-colors"
			>
				{textarea}
				{attachButton(true)}
				{sendButton}
			</form>
		)
	}

	return (
		<form
			onSubmit={submit}
			className="border-border-strong bg-surface focus-within:border-foreground flex flex-col gap-2 rounded-[26px] border pt-3.5 pr-3.5 pb-2.5 pl-[18px] transition-colors"
		>
			{textarea}
			<div className="flex flex-wrap items-center gap-1.5">
				{mode ? (
					<span className="bg-accent-subtle text-accent animate-in fade-in zoom-in-95 flex h-8 items-center gap-1.5 rounded-full pr-1.5 pl-2.5 text-[13px] duration-200">
						{MODES[mode].short}
						<button
							type="button"
							onClick={onClearMode}
							aria-label="Clear task"
							className="grid size-5 cursor-pointer place-items-center rounded-full"
						>
							<X className="size-3" strokeWidth={2} />
						</button>
					</span>
				) : null}
				{attachButton(false)}
				<SourcesSelect />
				<span className="flex-1" />
				<span className="text-muted hidden text-xs sm:inline">
					Any language
				</span>
				{sendButton}
			</div>
		</form>
	)
}

function SourcesSelect() {
	const { data: collections } = useGetCollections()

	return (
		<select
			aria-label="Sources"
			defaultValue=""
			className="text-secondary hover:bg-surface-muted h-8 cursor-pointer rounded-xl bg-transparent px-2.5 text-[13px] outline-none"
		>
			<option value="">All knowledge</option>
			{collections?.map((collection) => (
				<option key={collection.id} value={collection.id}>
					{collection.name}
				</option>
			))}
		</select>
	)
}
