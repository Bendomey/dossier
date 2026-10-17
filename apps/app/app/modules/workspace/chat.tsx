import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Composer } from './composer'
import { AssistantMessage, UserMessage } from './message'
import {
	isReplying,
	useCancelReply,
	useGetChat,
	useReplyStream,
	useSendMessage,
} from '~/api/chats'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { useAppBase } from '~/providers/app-base-provider'

export function ChatModule() {
	const { chatId = '' } = useParams()
	const navigate = useNavigate()
	const { path } = useAppBase()
	const { data: chat, isPending, isError, error } = useGetChat(chatId)
	const sendMessage = useSendMessage(chatId)
	const cancelReply = useCancelReply(chatId)
	const [draft, setDraft] = useState('')
	const threadRef = useRef<HTMLDivElement>(null)

	useReplyStream(chat)

	const lastMessage = chat?.messages.at(-1)
	const replying = isReplying(lastMessage)

	useEffect(() => {
		const thread = threadRef.current
		if (thread) thread.scrollTop = thread.scrollHeight
	}, [lastMessage?.text, lastMessage?.status, chat?.messages.length])

	if (isError) {
		return (
			<div className="flex flex-1 items-center justify-center p-6">
				<EmptyState
					title="This chat isn’t available"
					description={error.message}
					action={
						<Button variant="secondary" onClick={() => navigate(path('/'))}>
							Start a new chat
						</Button>
					}
				/>
			</div>
		)
	}

	function ask(prompt: string) {
		sendMessage.mutate({ prompt, mode: null })
	}

	function send() {
		const prompt = draft.trim()
		setDraft('')
		ask(prompt)
	}

	const questionBefore = (index: number) =>
		chat?.messages
			.slice(0, index)
			.findLast((message) => message.role === 'USER')?.text

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="desk:flex border-border-subtle hidden h-14 shrink-0 items-center gap-3 border-b px-10">
				<span className="flex-1 truncate text-sm font-medium">
					{chat?.title}
				</span>
				<Button variant="secondary" size="sm">
					Share
				</Button>
			</div>

			<div
				ref={threadRef}
				className="flex-1 overflow-auto px-4 pt-8 pb-6 md:px-10"
			>
				<div className="mx-auto flex max-w-[760px] flex-col gap-7">
					{isPending ? (
						<Skeleton avatar lines={4} label="Loading chat" />
					) : (
						chat.messages.map((message, index) =>
							message.role === 'USER' ? (
								<UserMessage key={message.id} text={message.text} />
							) : (
								<AssistantMessage
									key={message.id}
									message={message}
									onStop={() => cancelReply.mutate(message.id)}
									onRetry={
										replying
											? undefined
											: () => {
													const question = questionBefore(index)
													if (question) ask(question)
												}
									}
								/>
							),
						)
					)}
					{sendMessage.isError ? (
						<Alert tone="danger" title="Your message wasn’t sent">
							{sendMessage.error.message}
						</Alert>
					) : null}
				</div>
			</div>

			<div className="shrink-0 px-4 pb-5 md:px-10">
				<div className="mx-auto max-w-[760px]">
					<Composer
						variant="follow-up"
						value={draft}
						onValueChange={setDraft}
						onSubmit={send}
						busy={replying || sendMessage.isPending}
						placeholder="Ask a follow-up…"
					/>
					<p className="text-muted mt-2 text-center text-xs">
						Generated content stays editable. Check important answers against
						the cited sources.
					</p>
				</div>
			</div>
		</div>
	)
}
