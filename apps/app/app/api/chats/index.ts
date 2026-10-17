import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import * as live from './client'
import { QUERY_KEYS } from '~/lib/constants'
import * as mock from '~/lib/mock/db'
import { useAppBase } from '~/providers/app-base-provider'

interface ChatApi {
	listChats(): Promise<ChatSummary[]>
	getChat(chatId: string): Promise<Chat>
	createChat(input: NewChatInput): Promise<Chat>
	sendMessage(chatId: string, input: NewMessageInput): Promise<Chat>
	cancelReply(chatId: string, messageId: string): Promise<unknown>
	listCollections(): Promise<ChatCollectionOption[]>
	streamReply(
		chatId: string,
		messageId: string,
		onEvent: (event: ChatStreamEvent) => void,
		signal: AbortSignal,
	): void | Promise<void>
}

const liveApi: ChatApi = {
	listChats: live.listChats,
	getChat: live.getChat,
	createChat: live.createChat,
	sendMessage: live.sendMessage,
	cancelReply: live.cancelReply,
	listCollections: live.listChatCollections,
	streamReply: live.streamReply,
}

const demoApi: ChatApi = {
	listChats: mock.listChats,
	getChat: mock.getChat,
	createChat: ({ prompt, mode }) => mock.createChat(prompt, mode),
	sendMessage: (chatId, { prompt, mode }) =>
		mock.sendMessage(chatId, prompt, mode),
	cancelReply: async () => undefined,
	listCollections: async () =>
		(await mock.listCollections()).map(({ id, name }) => ({ id, name })),
	streamReply: (chatId, _messageId, onEvent, signal) =>
		mock.streamReply(chatId, onEvent, signal),
}

function useChatApi() {
	const { demo } = useAppBase()
	return demo
		? { api: demoApi, scope: 'demo' as const }
		: { api: liveApi, scope: 'live' as const }
}

const chatsKey = (scope: string) => [QUERY_KEYS.CHATS, scope]
const chatKey = (scope: string, chatId: string) => [
	QUERY_KEYS.CHATS,
	scope,
	chatId,
]

export const isReplying = (message?: ChatMessage) =>
	message?.role === 'ASSISTANT' &&
	(message.status === 'PENDING' || message.status === 'STREAMING')

export const useGetChats = () => {
	const { api, scope } = useChatApi()
	return useQuery({ queryKey: chatsKey(scope), queryFn: api.listChats })
}

export const useGetChat = (chatId: string) => {
	const { api, scope } = useChatApi()
	return useQuery({
		queryKey: chatKey(scope, chatId),
		queryFn: () => api.getChat(chatId),
	})
}

export const useGetChatCollections = () => {
	const { api, scope } = useChatApi()
	return useQuery({
		queryKey: [QUERY_KEYS.CHATS, scope, 'collections'],
		queryFn: api.listCollections,
	})
}

export const useCreateChat = () => {
	const queryClient = useQueryClient()
	const { api, scope } = useChatApi()
	return useMutation({
		mutationFn: (input: NewChatInput) => api.createChat(input),
		onSuccess: (chat) => {
			queryClient.setQueryData(chatKey(scope, chat.id), chat)
			return queryClient.invalidateQueries({
				queryKey: chatsKey(scope),
				exact: true,
			})
		},
	})
}

export const useSendMessage = (chatId: string) => {
	const queryClient = useQueryClient()
	const { api, scope } = useChatApi()
	return useMutation({
		mutationFn: (input: NewMessageInput) => api.sendMessage(chatId, input),
		onSuccess: (chat) =>
			queryClient.setQueryData(chatKey(scope, chat.id), chat),
	})
}

export const useCancelReply = (chatId: string) => {
	const queryClient = useQueryClient()
	const { api, scope } = useChatApi()
	return useMutation({
		mutationFn: (messageId: string) => api.cancelReply(chatId, messageId),
		onSuccess: (_, messageId) =>
			queryClient.setQueryData<Chat>(
				chatKey(scope, chatId),
				(current) =>
					current && {
						...current,
						messages: current.messages.map((message) =>
							message.id === messageId && isReplying(message)
								? { ...message, status: 'CANCELLED' }
								: message,
						),
					},
			),
	})
}

function applyEvent(message: ChatMessage, event: ChatStreamEvent): ChatMessage {
	switch (event.type) {
		case 'status':
			return { ...message, status: 'STREAMING', status_label: event.label }
		case 'snapshot':
			return {
				...message,
				status: 'STREAMING',
				status_label: event.label,
				text: event.text,
			}
		case 'delta':
			return { ...message, text: message.text + event.text }
		case 'citations':
			return { ...message, citations: event.citations }
		case 'attachments': {
			const { type: _, ...attachments } = event
			return { ...message, ...attachments }
		}
		case 'error':
			return {
				...message,
				status: event.code === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
				error: { code: event.code, retryable: event.retryable },
			}
		case 'done':
			return {
				...message,
				status: 'DONE',
				unsupported: event.unsupported,
				clarifying: event.clarifying,
			}
	}
}

/**
 * Streams the chat's unfinished assistant reply into the query cache, so any
 * component reading the chat re-renders as text arrives.
 */
export function useReplyStream(chat?: Chat) {
	const queryClient = useQueryClient()
	const { api, scope } = useChatApi()
	const chatId = chat?.id
	const pendingId = chat?.messages.findLast(isReplying)?.id

	useEffect(() => {
		if (!chatId || !pendingId) return
		const controller = new AbortController()

		void api.streamReply(
			chatId,
			pendingId,
			(event) => {
				queryClient.setQueryData<Chat>(
					chatKey(scope, chatId),
					(current) =>
						current && {
							...current,
							messages: current.messages.map((message) =>
								message.id === pendingId ? applyEvent(message, event) : message,
							),
						},
				)
				if (event.type === 'done') {
					void queryClient.invalidateQueries({
						queryKey: chatsKey(scope),
						exact: true,
					})
				}
			},
			controller.signal,
		)

		return () => controller.abort()
	}, [api, scope, chatId, pendingId, queryClient])
}
