import { createHmac, timingSafeEqual } from 'node:crypto'
import { UploadError, type UploadExtension } from './validation'

export const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000

export interface UploadClaims {
	upload_id: string
	organization_id: string
	user_id: string
	collection_id: string
	document_id: string | null
	file_name: string
	extension: UploadExtension
	content_type: string
	size: number
	staging_key: string
	expires_at: number
}

const sign = (payload: string, secret: string) =>
	createHmac('sha256', `upload-token:${secret}`).update(payload).digest()

export function signUploadToken(claims: UploadClaims, secret: string) {
	const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
	return `${payload}.${sign(payload, secret).toString('base64url')}`
}

export function verifyUploadToken(
	token: string,
	secret: string,
	now = Date.now(),
): UploadClaims {
	const invalid = new UploadError(
		'This upload isn’t valid. Add the file again.',
	)
	const [payload, signature, extra] = token.split('.')
	if (!payload || !signature || extra !== undefined) throw invalid
	const expected = sign(payload, secret)
	const actual = Buffer.from(signature, 'base64url')
	if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
		throw invalid
	}
	let claims: unknown
	try {
		claims = JSON.parse(Buffer.from(payload, 'base64url').toString())
	} catch {
		throw invalid
	}
	if (!claims || typeof claims !== 'object' || Array.isArray(claims)) {
		throw invalid
	}
	const uploadClaims = claims as UploadClaims
	if (uploadClaims.expires_at < now) {
		throw new UploadError('This upload has expired. Add the file again.')
	}
	return uploadClaims
}
