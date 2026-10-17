/** Yields the `data` payload of each server-sent event; comments (`: ping`) are skipped. */
export async function* readSse(body: ReadableStream<Uint8Array<ArrayBuffer>>) {
	const reader = body.pipeThrough(new TextDecoderStream()).getReader()
	let buffer = ''
	try {
		for (;;) {
			const { value, done } = await reader.read()
			if (done) break
			buffer = (buffer + value).replaceAll('\r\n', '\n')
			let boundary = buffer.indexOf('\n\n')
			while (boundary !== -1) {
				const data = buffer
					.slice(0, boundary)
					.split('\n')
					.filter((line) => line.startsWith('data:'))
					.map((line) => line.slice(5).trimStart())
					.join('\n')
				buffer = buffer.slice(boundary + 2)
				if (data) yield data
				boundary = buffer.indexOf('\n\n')
			}
		}
	} finally {
		reader.releaseLock()
	}
}
