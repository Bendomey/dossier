/** A chunk retrieved for one reply, with everything a citation needs. */
export interface Passage {
	chunkId: string
	documentId: string
	documentName: string
	versionId: string
	versionNumber: number
	content: string
	pageStart: number | null
	pageEnd: number | null
	sectionNumber: string | null
	sectionTitle: string | null
	tokenCount: number
	score: number
}

export const sectionLabel = (number: string | null, title: string | null) =>
	[number, title].filter(Boolean).join(' ') || null

/** The only sources a model may cite in one reply, under opaque keys (S1, S2…). */
export class SourceSet {
	private readonly passages = new Map<string, Passage>()

	register(passage: Passage) {
		const key = `S${this.passages.size + 1}`
		this.passages.set(key, passage)
		return key
	}

	get(key: string) {
		return this.passages.get(key)
	}

	get size() {
		return this.passages.size
	}
}
