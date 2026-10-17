import {
	getReply,
	saveReplyProgress,
	sweepStalledReplies,
} from '~/api/chats/server'

const FLUSH_MS = 1_000
const HEARTBEAT_MS = 20_000
const POLL_MS = 750
const SWEEP_MS = 60_000

type Listener = (event: ChatStreamEvent) => void

interface LiveReply {
	listeners: Set<Listener>
	controller: AbortController
	text: string
	label: string
	finished: Promise<void>
}

declare global {
	var __liveReplies: Map<string, LiveReply> | undefined
	var __stallSweep: NodeJS.Timeout | undefined
}

/** Replies running in this process. Another machine, or a reload after this one restarted, falls back to polling the row. */
const live = (globalThis.__liveReplies ??= new Map<string, LiveReply>())

export function ensureStallSweep() {
	globalThis.__stallSweep ??= setInterval(() => {
		sweepStalledReplies().catch((error: unknown) =>
			console.error('Stall sweep failed', error),
		)
	}, SWEEP_MS)
	globalThis.__stallSweep.unref()
}

function progressWriter(messageId: string, reply: LiveReply) {
	let dirty = true
	let writing = false
	let lastWrite = 0
	const timer = setInterval(() => {
		if (writing || (!dirty && Date.now() - lastWrite < HEARTBEAT_MS)) return
		writing = true
		dirty = false
		lastWrite = Date.now()
		saveReplyProgress(messageId, reply.text, reply.label)
			.catch((error: unknown) =>
				console.error('Could not save reply progress', error),
			)
			.finally(() => {
				writing = false
			})
	}, FLUSH_MS)
	return {
		touch: () => {
			dirty = true
		},
		stop: () => clearInterval(timer),
	}
}

/** Registers a reply synchronously, so a stream request that arrives right after the POST finds it. */
export function openReply(messageId: string) {
	let finish = () => {}
	const reply: LiveReply = {
		listeners: new Set(),
		controller: new AbortController(),
		text: '',
		label: '',
		finished: new Promise<void>((resolve) => {
			finish = resolve
		}),
	}
	live.set(messageId, reply)
	const writer = progressWriter(messageId, reply)
	const emit = (event: ChatStreamEvent) =>
		reply.listeners.forEach((listener) => listener(event))

	return {
		signal: reply.controller.signal,
		get text() {
			return reply.text
		},
		status(label: string) {
			reply.label = label
			writer.touch()
			emit({ type: 'status', label })
		},
		delta(text: string) {
			reply.text += text
			writer.touch()
			emit({ type: 'delta', text })
		},
		emit,
		close() {
			writer.stop()
			live.delete(messageId)
			finish()
		},
	}
}

export type OpenReply = ReturnType<typeof openReply>

export function abortReply(messageId: string) {
	live.get(messageId)?.controller.abort()
}

const untilAborted = (signal: AbortSignal) =>
	new Promise<void>((resolve) => {
		if (signal.aborted) resolve()
		signal.addEventListener('abort', () => resolve(), { once: true })
	})

const wait = (ms: number, signal: AbortSignal) =>
	Promise.race([
		new Promise((resolve) => setTimeout(resolve, ms)),
		untilAborted(signal),
	])

function sendFinal(message: ChatMessage, send: Listener) {
	if (message.status === 'DONE') {
		send({ type: 'citations', citations: message.citations ?? [] })
		send({
			type: 'done',
			unsupported: message.unsupported,
			clarifying: message.clarifying,
		})
		return true
	}
	if (message.status === 'FAILED' || message.status === 'CANCELLED') {
		send({
			type: 'error',
			code: message.error?.code ?? message.status,
			retryable:
				message.status === 'CANCELLED' || (message.error?.retryable ?? false),
		})
		return true
	}
	return false
}

/** Sends a snapshot of the reply so far, then its events until it ends. */
export async function followReply(
	session: Session,
	chatId: string,
	messageId: string,
	send: Listener,
	signal: AbortSignal,
) {
	const reply = live.get(messageId)
	if (reply) {
		send({ type: 'snapshot', text: reply.text, label: reply.label })
		reply.listeners.add(send)
		await Promise.race([reply.finished, untilAborted(signal)])
		reply.listeners.delete(send)
		return
	}

	let sent: string | null = null
	let label = ''
	while (!signal.aborted) {
		const message = await getReply(session, chatId, messageId)
		const nextLabel = message.status_label ?? ''
		if (sent === null || !message.text.startsWith(sent)) {
			send({ type: 'snapshot', text: message.text, label: nextLabel })
		} else if (message.text !== sent) {
			send({ type: 'delta', text: message.text.slice(sent.length) })
		} else if (nextLabel !== label) {
			send({ type: 'status', label: nextLabel })
		}
		sent = message.text
		label = nextLabel
		if (sendFinal(message, send)) return
		await wait(POLL_MS, signal)
	}
}
