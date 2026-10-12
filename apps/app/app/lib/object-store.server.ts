import { AwsClient } from 'aws4fetch'
import { environmentVariables } from './actions/env.server'

export interface StoredObject {
	size: number
	contentType: string | null
}

export interface ObjectStore {
	presignPut(
		key: string,
		options: { contentType: string; expiresInSeconds: number },
	): Promise<string>
	presignGet(
		key: string,
		options: { expiresInSeconds: number; downloadName: string },
	): Promise<string>
	head(key: string): Promise<StoredObject | null>
	readRange(
		key: string,
		range: { start: number; end: number } | { suffix: number },
	): Promise<Uint8Array>
	copy(fromKey: string, toKey: string): Promise<void>
	remove(key: string): Promise<void>
}

export interface R2Config {
	accountId: string
	accessKeyId: string
	secretAccessKey: string
	bucket: string
}

const encodeKey = (key: string) =>
	key.split('/').map(encodeURIComponent).join('/')

export function createR2Store(
	config: R2Config,
	fetchImpl: typeof fetch = fetch,
): ObjectStore {
	const client = new AwsClient({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		service: 's3',
		region: 'auto',
	})
	const objectUrl = (key: string) =>
		`https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${encodeKey(key)}`

	async function send(request: Request) {
		return fetchImpl(await client.sign(request))
	}

	async function presign(url: URL, init: RequestInit) {
		const signed = await client.sign(new Request(url, init), {
			aws: { signQuery: true, allHeaders: true },
		})
		return signed.url
	}

	return {
		presignPut(key, { contentType, expiresInSeconds }) {
			const url = new URL(objectUrl(key))
			url.searchParams.set('X-Amz-Expires', String(expiresInSeconds))
			return presign(url, {
				method: 'PUT',
				headers: { 'Content-Type': contentType },
			})
		},
		presignGet(key, { expiresInSeconds, downloadName }) {
			const url = new URL(objectUrl(key))
			url.searchParams.set('X-Amz-Expires', String(expiresInSeconds))
			url.searchParams.set(
				'response-content-disposition',
				`attachment; filename*=UTF-8''${encodeURIComponent(downloadName).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())}`,
			)
			return presign(url, { method: 'GET' })
		},
		async head(key) {
			const response = await send(
				new Request(objectUrl(key), { method: 'HEAD' }),
			)
			if (response.status === 404) return null
			if (!response.ok) throw new Error(`R2 head failed (${response.status})`)
			return {
				size: Number(response.headers.get('content-length') ?? 0),
				contentType: response.headers.get('content-type'),
			}
		},
		async readRange(key, range) {
			const header =
				'suffix' in range
					? `bytes=-${range.suffix}`
					: `bytes=${range.start}-${range.end}`
			const response = await send(
				new Request(objectUrl(key), { headers: { Range: header } }),
			)
			if (!response.ok) throw new Error(`R2 read failed (${response.status})`)
			return new Uint8Array(await response.arrayBuffer())
		},
		async copy(fromKey, toKey) {
			const response = await send(
				new Request(objectUrl(toKey), {
					method: 'PUT',
					headers: {
						'x-amz-copy-source': `/${config.bucket}/${encodeKey(fromKey)}`,
					},
				}),
			)
			if (!response.ok) throw new Error(`R2 copy failed (${response.status})`)
		},
		async remove(key) {
			const response = await send(
				new Request(objectUrl(key), { method: 'DELETE' }),
			)
			if (!response.ok && response.status !== 404) {
				throw new Error(`R2 delete failed (${response.status})`)
			}
		},
	}
}

/** The configured R2 store, or null when its credentials are missing. */
export function objectStore(): ObjectStore | null {
	const env = environmentVariables()
	if (
		!env.R2_ACCOUNT_ID ||
		!env.R2_ACCESS_KEY_ID ||
		!env.R2_SECRET_ACCESS_KEY ||
		!env.R2_BUCKET
	) {
		return null
	}
	return createR2Store({
		accountId: env.R2_ACCOUNT_ID,
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		bucket: env.R2_BUCKET,
	})
}
