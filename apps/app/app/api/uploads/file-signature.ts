import type { UploadExtension } from './validation'

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]
const DOCX_ENTRY = new TextEncoder().encode('word/document.xml')

const startsWith = (data: Uint8Array, magic: number[]) =>
	magic.every((byte, index) => data[index] === byte)

function contains(data: Uint8Array, needle: Uint8Array) {
	outer: for (let i = 0; i <= data.length - needle.length; i++) {
		for (let j = 0; j < needle.length; j++) {
			if (data[i + j] !== needle[j]) continue outer
		}
		return true
	}
	return false
}

/**
 * `head` is the start of the file; `tail` is its end, where a ZIP's central
 * directory lists entry names such as word/document.xml.
 */
export function hasValidSignature(
	extension: UploadExtension,
	head: Uint8Array,
	tail: Uint8Array,
) {
	switch (extension) {
		case 'pdf':
			return startsWith(head, PDF_MAGIC)
		case 'docx':
			return startsWith(head, ZIP_MAGIC) && contains(tail, DOCX_ENTRY)
		case 'txt':
		case 'md':
			return !head.includes(0)
	}
}
