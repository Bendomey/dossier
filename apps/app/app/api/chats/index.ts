import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { QUERY_KEYS } from '~/lib/constants'
import * as api from '~/lib/mock/db'

const chatKey = (chatId: string) => [QUERY_KEYS.CHATS, chatId]

export const useGetChats = () =>
	useQuery({ queryKey: [QUERY_KEYS.CHATS], queryFn: api.listChats })

export const useGetChat = (chatId: string) =>
	useQuery({
		queryKey: chatKey(chatId),
		queryFn: () => api.getChat(chatId),
	})

export const useCreateChat = () => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ prompt, mode }: { prompt: string; mode: ChatMode | null }) =>
			api.createChat(prompt, mode),
		onSuccess: (chat) => {
			queryClient.setQueryData(chatKey(chat.id), chat)
			return queryClient.invalidateQueries({
				queryKey: [QUERY_KEYS.CHATS],
				exact: true,
			})
		},
	})
}

export const useSendMessage = (chatId: string) => {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ prompt, mode }: { prompt: string; mode: ChatMode | null }) =>
			api.sendMessage(chatId, prompt, mode),
		onSuccess: (chat) => queryClient.setQueryData(chatKey(chat.id), chat),
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
		case 'attachments': {
			const { type: _, ...attachments } = event
			return { ...message, ...attachments }
		}
		case 'done':
			return { ...message, status: 'DONE' }
	}
}

/**
 * Streams the chat's unfinished assistant reply into the query cache, so any
 * component reading the chat re-renders as text arrives.
 */
export function useReplyStream(chat?: Chat) {
	const queryClient = useQueryClient()
	const unfinished = chat?.messages.findLast(
		(message) => message.role === 'ASSISTANT' && message.status !== 'DONE',
	)
	const chatId = chat?.id
	const pendingId = unfinished?.id

	useEffect(() => {
		if (!chatId || !pendingId) return
		const controller = new AbortController()

		api.streamReply(
			chatId,
			(event) =>
				queryClient.setQueryData<Chat>(
					chatKey(chatId),
					(current) =>
						current && {
							...current,
							messages: current.messages.map((message) =>
								message.id === pendingId ? applyEvent(message, event) : message,
							),
						},
				),
			controller.signal,
		)

		return () => controller.abort()
	}, [chatId, pendingId, queryClient])
}
