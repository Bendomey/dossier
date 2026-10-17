import { readSse } from '~/lib/sse'

const RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY_MS = 2_000

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(url, {
		...init,
		redirect: 'manual',
		headers: {
			accept: 'application/json',
			...(init.body ? { 'content-type': 'application/json' } : {}),
			...init.headers,
		},
	})
	if (response.type === 'opaqueredirect') {
		throw new Error('Your session ended. Sign in again.')
	}
	const body: unknown = await response.json().catch(() => null)
	if (!response.ok) {
		const message =
			body && typeof body === 'object' && 'error' in body
				? String(body.error)
				: 'Something went wrong. Try again.'
		throw new Error(message)
	}
	return body as T
}

export const listChats = (cursor: string | null) =>
	call<ChatPage>(
		cursor ? `/api/chats?cursor=${encodeURIComponent(cursor)}` : '/api/chats',
	)

export const renameChat = (chatId: string, title: string) =>
	call<{ ok: boolean }>(`/api/chats/${chatId}`, {
		method: 'PATCH',
		body: JSON.stringify({ title }),
	})

export const archiveChat = (chatId: string) =>
	call<{ ok: boolean }>(`/api/chats/${chatId}/archive`, { method: 'POST' })

export const getChat = (chatId: string) => call<Chat>(`/api/chats/${chatId}`)

export const createChat = (input: NewChatInput) =>
	call<Chat>('/api/chats', {
		method: 'POST',
		headers: { 'idempotency-key': crypto.randomUUID() },
		body: JSON.stringify({
			prompt: input.prompt,
			mode: input.mode,
			collection_id: input.collectionId,
		}),
	})

export const sendMessage = (chatId: string, input: NewMessageInput) =>
	call<Chat>(`/api/chats/${chatId}/messages`, {
		method: 'POST',
		headers: { 'idempotency-key': crypto.randomUUID() },
		body: JSON.stringify({ prompt: input.prompt, mode: input.mode }),
	})

export const cancelReply = (chatId: string, messageId: string) =>
	call<{ ok: boolean }>(`/api/chats/${chatId}/cancel`, {
		method: 'POST',
		body: JSON.stringify({ message_id: messageId }),
	})

export const listChatCollections = () =>
	call<ChatCollectionOption[]>('/api/collections')

const pause = (ms: number, signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		const timer = setTimeout(resolve, ms)
		signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timer)
				resolve()
			},
			{ once: true },
		)
	})

/** Follows a reply until it ends, reconnecting after drops; each reconnect starts with a snapshot. */
export async function streamReply(
	chatId: string,
	messageId: string,
	onEvent: (event: ChatStreamEvent) => void,
	signal: AbortSignal,
) {
	for (let attempt = 0; attempt <= RECONNECT_ATTEMPTS; attempt++) {
		if (attempt) await pause(RECONNECT_DELAY_MS, signal)
		if (signal.aborted) return
		try {
			const response = await fetch(
				`/api/chats/${chatId}/stream?message=${messageId}`,
				{
					signal,
					redirect: 'manual',
					headers: { accept: 'text/event-stream' },
				},
			)
			if (response.status === 404) break
			if (!response.ok || !response.body) continue
			for await (const data of readSse(response.body)) {
				const event = JSON.parse(data) as ChatStreamEvent
				onEvent(event)
				if (event.type === 'done' || event.type === 'error') return
			}
		} catch {
			if (signal.aborted) return
		}
	}
	onEvent({ type: 'error', code: 'CONNECTION_LOST', retryable: true })
}
