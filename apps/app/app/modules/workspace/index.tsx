import { ChevronRight, Lock } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Composer } from './composer'
import { MODE_KEYS, MODES, isChatMode } from './modes'
import { useDemoPlay } from './use-demo-play'
import { useCreateChat } from '~/api/chats'
import { Alert } from '~/components/arc/alert/alert'
import { Badge } from '~/components/arc/badge/badge'
import { cn } from '~/lib/utils'
import { useAppBase } from '~/providers/app-base-provider'
import { useSession } from '~/providers/session-provider'

const AVAILABLE_MODES: ChatMode[] = ['ASK']

export function WorkspaceModule() {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const { organization } = useSession()
	const createChat = useCreateChat()
	const { path, demo } = useAppBase()

	const isAvailable = (key: ChatMode) => demo || AVAILABLE_MODES.includes(key)
	const initialMode = searchParams.get('mode')
	const [mode, setMode] = useState<ChatMode | null>(
		isChatMode(initialMode) && isAvailable(initialMode) ? initialMode : null,
	)
	const [draft, setDraft] = useState(searchParams.get('draft') ?? '')
	const [collectionId, setCollectionId] = useState<string | null>(null)
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	function send(prompt = draft.trim(), chatMode = mode) {
		createChat.mutate(
			{ prompt, mode: chatMode, collectionId },
			{
				onSuccess: (chat) =>
					navigate(path(`/chats/${chat.id}`), { replace: demo }),
			},
		)
	}

	useDemoPlay({
		play: searchParams.get('play'),
		enabled: demo,
		onMode: setMode,
		onType: setDraft,
		onSend: send,
	})

	return (
		<div className="flex flex-1 flex-col items-center justify-center overflow-auto px-4 pt-12 pb-16 md:px-10">
			<div className="animate-in fade-in slide-in-from-bottom-1.5 flex w-full max-w-[760px] flex-col gap-7 duration-400">
				<div className="flex flex-col gap-2.5 text-center">
					<h1 className="font-heading text-[clamp(30px,4vw,44px)] leading-[1.1] font-medium tracking-[-0.03em]">
						What would you like to work on?
					</h1>
					<p className="text-secondary text-base text-pretty">
						Ask a question, draft a document or review a file. Justo answers
						from {organization.name} knowledge.
					</p>
				</div>

				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-2.5">
					{MODE_KEYS.map((key) => {
						const Icon = MODES[key].icon
						const active = mode === key
						return (
							<button
								key={key}
								type="button"
								aria-pressed={active}
								disabled={!isAvailable(key)}
								onClick={() => setMode(active ? null : key)}
								className={cn(
									'flex cursor-pointer flex-col items-start gap-2.5 rounded-[22px] border p-4 text-left transition-[border-color,background-color,transform] enabled:active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60',
									active
										? 'border-accent bg-accent-subtle'
										: 'bg-surface enabled:hover:border-border-strong',
								)}
							>
								<span className="flex w-full items-start justify-between gap-2">
									<Icon
										className={cn(
											'size-5',
											active ? 'text-accent' : 'text-foreground',
										)}
										strokeWidth={1.75}
									/>
									{isAvailable(key) ? null : (
										<Badge tone="neutral" size="sm">
											Soon
										</Badge>
									)}
								</span>
								<span className="flex flex-col gap-0.5">
									<span className="text-sm font-medium">
										{MODES[key].label}
									</span>
									<span className="text-secondary text-[13px] leading-[1.35]">
										{MODES[key].description}
									</span>
								</span>
							</button>
						)
					})}
				</div>

				<Composer
					variant="start"
					value={draft}
					onValueChange={setDraft}
					onSubmit={() => send()}
					busy={createChat.isPending}
					mode={mode}
					onClearMode={() => setMode(null)}
					collectionId={collectionId}
					onCollectionChange={setCollectionId}
					placeholder={
						mode ? MODES[mode].placeholder : 'Ask anything or describe a task…'
					}
					autoFocus={!demo}
					textareaRef={textareaRef}
				/>

				{createChat.isError ? (
					<Alert tone="danger" title="Your message wasn’t sent">
						{createChat.error.message}
					</Alert>
				) : null}

				{mode ? (
					<div
						key={mode}
						className="animate-in fade-in slide-in-from-bottom-1.5 -mt-3 flex flex-col duration-300"
					>
						{MODES[mode].examples.map((example) => (
							<button
								key={example}
								type="button"
								onClick={() => {
									setDraft(example)
									textareaRef.current?.focus()
								}}
								className="border-border-subtle text-secondary hover:text-foreground flex cursor-pointer items-center gap-3 border-b px-2 py-3 text-left text-sm"
							>
								<ChevronRight
									className="text-muted size-4 shrink-0"
									strokeWidth={1.75}
								/>
								{example}
							</button>
						))}
					</div>
				) : null}

				<p className="text-muted flex items-center justify-center gap-2 text-center text-[13px]">
					<Lock className="size-3.5 shrink-0" strokeWidth={1.75} />
					Answers only use documents you have access to, and cite their sources.
				</p>
			</div>
		</div>
	)
}
