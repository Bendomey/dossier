import type { SourceSet } from './sources.server'

const MARKER_LOOKAHEAD = 24
const SOURCE_GROUP = /^\[\s*S\d+(?:\s*,\s*S\d+)*\s*\]$/

export const stripCitationMarkers = (text: string) =>
	text.replace(/\[\d+\]/g, '')

/**
 * Rewrites the model's [S3] / [S2, S5] markers into [1], [2]… numbered by
 * first appearance, while text streams in. Markers can arrive split across
 * chunks, so text from an unmatched "[" is held back until its "]" arrives or
 * MARKER_LOOKAHEAD characters pass. Keys outside the SourceSet are dropped.
 */
export class CitationRewriter {
	invalid = 0
	private pending = ''
	private readonly orders = new Map<string, number>()

	constructor(private readonly sources: SourceSet) {}

	push(text: string) {
		this.pending += text
		let output = ''
		for (;;) {
			const open = this.pending.indexOf('[')
			if (open === -1) {
				output += this.pending
				this.pending = ''
				return output
			}
			output += this.pending.slice(0, open)
			this.pending = this.pending.slice(open)

			const close = this.pending.indexOf(']')
			const nextOpen = this.pending.indexOf('[', 1)
			if (nextOpen !== -1 && (close === -1 || nextOpen < close)) {
				output += this.pending.slice(0, nextOpen)
				this.pending = this.pending.slice(nextOpen)
				continue
			}
			if (close === -1) {
				if (this.pending.length <= MARKER_LOOKAHEAD) return output
				output += this.pending[0]
				this.pending = this.pending.slice(1)
				continue
			}
			output += this.rewrite(this.pending.slice(0, close + 1))
			this.pending = this.pending.slice(close + 1)
		}
	}

	flush() {
		const rest = this.pending
		this.pending = ''
		return rest
	}

	cited() {
		return [...this.orders].map(([key, order]) => ({ key, order }))
	}

	private rewrite(group: string) {
		if (!SOURCE_GROUP.test(group)) return group
		const orders = group
			.slice(1, -1)
			.split(',')
			.map((key) => key.trim())
			.flatMap((key) => {
				if (!this.sources.get(key)) {
					this.invalid++
					return []
				}
				if (!this.orders.has(key)) this.orders.set(key, this.orders.size + 1)
				return [this.orders.get(key)!]
			})
		return [...new Set(orders)].map((order) => `[${order}]`).join('')
	}
}
