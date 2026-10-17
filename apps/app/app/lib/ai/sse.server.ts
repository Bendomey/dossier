const PING_MS = 15_000

/** A server-sent event response that closes when `run` finishes or the browser leaves. */
export function eventStream(
	signal: AbortSignal,
	run: (send: (event: ChatStreamEvent) => void) => Promise<void>,
) {
	const encoder = new TextEncoder()
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			let open = true
			const write = (chunk: string) => {
				if (!open) return
				try {
					controller.enqueue(encoder.encode(chunk))
				} catch {
					open = false
				}
			}
			const ping = setInterval(() => write(': ping\n\n'), PING_MS)
			const close = () => {
				clearInterval(ping)
				if (!open) return
				open = false
				try {
					controller.close()
				} catch {
					// the browser already left
				}
			}
			signal.addEventListener('abort', close, { once: true })
			run((event) => write(`data: ${JSON.stringify(event)}\n\n`))
				.catch((error: unknown) => {
					console.error('Event stream failed', error)
					write(
						`data: ${JSON.stringify({ type: 'error', code: 'INTERNAL', retryable: true })}\n\n`,
					)
				})
				.finally(close)
		},
	})
	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			// no-transform stops react-router-serve's compression from buffering the stream
			'cache-control': 'no-store, no-transform',
			'x-accel-buffering': 'no',
		},
	})
}
