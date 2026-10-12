const MESSAGES: Record<string, string> = {
	UNSUPPORTED_FORMAT:
		'We can’t read this kind of file. Upload a PDF, DOCX, TXT or Markdown file.',
	CORRUPT_FILE:
		'This file is damaged and can’t be opened. Upload a fresh copy.',
	ENCRYPTED:
		'This PDF is password-protected. Upload a copy without a password.',
	NO_TEXT_FOUND:
		'We couldn’t find any text in this file. If it’s a scan, check the pages are legible.',
	TOO_MANY_PAGES:
		'This file has more than 300 pages. Split it into smaller files.',
	OCR_LIMIT_REACHED:
		'This file needs more scanned-page reading than we can do right now. Try a smaller file, or try again next month.',
	SOURCE_MISSING: 'We can’t find the original file. Upload it again.',
	SUPERSEDED: 'A newer version replaced this one before it finished.',
}

const GENERIC = 'Something went wrong on our side. Try again in a few minutes.'
const NOT_RETRYABLE = new Set([
	'SOURCE_MISSING',
	'SUPERSEDED',
	'INVALID_MESSAGE',
])

export const indexingErrorMessage = (code: string | null) =>
	(code && MESSAGES[code]) || GENERIC

export const canRetryCode = (code: string | null) =>
	!code || !NOT_RETRYABLE.has(code)
