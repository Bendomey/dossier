export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const MAX_NAME_LENGTH = 200

export type UploadExtension = 'pdf' | 'docx' | 'txt' | 'md'

export const CONTENT_TYPES: Record<UploadExtension, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	txt: 'text/plain',
	md: 'text/markdown',
}

const LABELS: Record<UploadExtension, 'PDF' | 'DOCX' | 'TXT' | 'MD'> = {
	pdf: 'PDF',
	docx: 'DOCX',
	txt: 'TXT',
	md: 'MD',
}

// Browsers report these when they don't know a type, and .md often arrives as text/plain.
const VAGUE_TYPES = ['', 'application/octet-stream']
const ALSO_ACCEPTED: Partial<Record<UploadExtension, string[]>> = {
	md: ['text/plain', 'text/x-markdown'],
}

export class UploadError extends Error {}

export const fileTypeLabel = (extension: UploadExtension) => LABELS[extension]

const isExtension = (value: string): value is UploadExtension =>
	Object.hasOwn(CONTENT_TYPES, value)

export function cleanFileName(name: string) {
	const base = name.split(/[\\/]/).pop() ?? ''
	const cleaned = base
		.replace(/[\u0000-\u001f\u007f]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
	if (cleaned.length <= MAX_NAME_LENGTH) return cleaned
	const dot = cleaned.lastIndexOf('.')
	const extension = dot > 0 ? cleaned.slice(dot) : ''
	return cleaned.slice(0, MAX_NAME_LENGTH - extension.length) + extension
}

export function validateUpload(input: {
	fileName: string
	size: number
	contentType: string
}) {
	const fileName = cleanFileName(input.fileName)
	const dot = fileName.lastIndexOf('.')
	const extension = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : ''
	if (!fileName || !isExtension(extension)) {
		throw new UploadError('Upload a PDF, DOCX, TXT or Markdown file.')
	}
	const reported = input.contentType.toLowerCase().split(';')[0]!.trim()
	const accepted = [
		CONTENT_TYPES[extension],
		...VAGUE_TYPES,
		...(ALSO_ACCEPTED[extension] ?? []),
	]
	if (!accepted.includes(reported)) {
		throw new UploadError(`That file doesn’t look like a ${LABELS[extension]}.`)
	}
	if (input.size <= 0) throw new UploadError('That file is empty.')
	if (input.size > MAX_UPLOAD_BYTES) {
		throw new UploadError('Files can be up to 25 MB.')
	}
	return { fileName, extension, contentType: CONTENT_TYPES[extension] }
}
