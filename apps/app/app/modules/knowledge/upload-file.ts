export type UploadProgress = {
	onProgress: (percent: number) => void
	signal: AbortSignal
}

export type PutFile = (
	url: string,
	file: File,
	headers: Record<string, string>,
	options: UploadProgress,
) => Promise<void>

const TRANSFER_SHARE = 95

const putWithProgress: PutFile = (url, file, headers, { onProgress, signal }) =>
	new Promise((resolve, reject) => {
		if (signal.aborted) return reject(new Error('Upload cancelled'))
		const request = new XMLHttpRequest()
		request.open('PUT', url)
		for (const [name, value] of Object.entries(headers)) {
			request.setRequestHeader(name, value)
		}
		request.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress(Math.round((event.loaded / event.total) * TRANSFER_SHARE))
			}
		}
		request.onload = () =>
			request.status >= 200 && request.status < 300
				? resolve()
				: reject(new Error('The upload failed. Try again.'))
		request.onerror = () =>
			reject(new Error('The upload failed. Check your connection.'))
		request.onabort = () => reject(new Error('Upload cancelled'))
		signal.addEventListener('abort', () => request.abort(), { once: true })
		request.send(file)
	})

const GENERIC_FAILURE = 'The upload failed. Try again.'

async function post<T>(
	fetchImpl: typeof fetch,
	url: string,
	body: unknown,
	signal: AbortSignal,
	isValid: (result: Partial<T>) => boolean,
) {
	const response = await fetchImpl(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal,
	})
	const result = (await response.json().catch(() => ({}))) as Partial<T> & {
		error?: string
	}
	signal.throwIfAborted()
	if (!response.ok) throw new Error(result.error ?? GENERIC_FAILURE)
	if (!isValid(result)) throw new Error(GENERIC_FAILURE)
	return result as T
}

export async function uploadFile(
	file: File,
	target: { url: string; collectionId: string; documentId?: string },
	options: UploadProgress,
	deps: { fetchImpl?: typeof fetch; put?: PutFile } = {},
) {
	const fetchImpl = deps.fetchImpl ?? fetch
	const started = await post<{
		upload_url: string
		headers: Record<string, string>
		token: string
	}>(
		fetchImpl,
		target.url,
		{
			intent: 'initiate',
			collection_id: target.collectionId,
			...(target.documentId ? { document_id: target.documentId } : {}),
			file_name: file.name,
			size: file.size,
			content_type: file.type,
		},
		options.signal,
		(result) =>
			typeof result.upload_url === 'string' &&
			typeof result.token === 'string' &&
			typeof result.headers === 'object' &&
			result.headers !== null,
	)
	await (deps.put ?? putWithProgress)(
		started.upload_url,
		file,
		started.headers,
		options,
	)
	const { document_id } = await post<{ document_id: string }>(
		fetchImpl,
		target.url,
		{ intent: 'complete', token: started.token },
		options.signal,
		(result) => typeof result.document_id === 'string',
	)
	options.onProgress(100)
	return { documentId: document_id }
}
