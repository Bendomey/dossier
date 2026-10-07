import { ChevronRight, Lock } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Composer } from './composer'
import { MODE_KEYS, MODES, isChatMode } from './modes'
import { useCreateChat } from '~/api/chats'
import { useGetOrganization } from '~/api/organization'
import { Alert } from '~/components/arc/alert/alert'
import { cn } from '~/lib/utils'

export function WorkspaceModule() {
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const { data: organization } = useGetOrganization()
	const createChat = useCreateChat()

	const initialMode = searchParams.get('mode')
	const [mode, setMode] = useState<ChatMode | null>(
		isChatMode(initialMode) ? initialMode : null,
	)
	const [draft, setDraft] = useState(searchParams.get('draft') ?? '')
	const textareaRef = useRef<HTMLTextAreaElement>(null)

	function send() {
		createChat.mutate(
			{ prompt: draft.trim(), mode },
			{ onSuccess: (chat) => navigate(`/chats/${chat.id}`) },
		)
	}

	return (
		<div className="flex flex-1 flex-col items-center justify-center overflow-auto px-4 pt-12 pb-16 md:px-10">
			<div className="animate-in fade-in slide-in-from-bottom-1.5 flex w-full max-w-[760px] flex-col gap-7 duration-400">
				<div className="flex flex-col gap-2.5 text-center">
					<h1 className="font-heading text-[clamp(30px,4vw,44px)] leading-[1.1] font-medium tracking-[-0.03em]">
						What would you like to work on?
					</h1>
					<p className="text-secondary text-base text-pretty">
						Ask a question, draft a document or review a file. Dossier answers
						from {organization?.name ?? 'your company’s'} knowledge.
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
								onClick={() => setMode(active ? null : key)}
								className={cn(
									'flex cursor-pointer flex-col items-start gap-2.5 rounded-[22px] border p-4 text-left transition-[border-color,background-color,transform] active:scale-[.98]',
									active
										? 'border-accent bg-accent-subtle'
										: 'bg-surface hover:border-border-strong',
								)}
							>
								<Icon
									className={cn(
										'size-5',
										active ? 'text-accent' : 'text-foreground',
									)}
									strokeWidth={1.75}
								/>
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
					onSubmit={send}
					busy={createChat.isPending}
					mode={mode}
					onClearMode={() => setMode(null)}
					placeholder={
						mode ? MODES[mode].placeholder : 'Ask anything or describe a task…'
					}
					autoFocus
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
