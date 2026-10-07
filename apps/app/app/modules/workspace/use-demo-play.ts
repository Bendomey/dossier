import { useEffect, useRef } from 'react'
import { MODES, isChatMode } from './modes'

const START_DELAY_MS = 700
const TYPE_INTERVAL_MS = 28
const SEND_DELAY_MS = 400

interface Options {
	/** Raw `?play=` value, such as "review". */
	play: string | null
	enabled: boolean
	onMode: (mode: ChatMode) => void
	onType: (text: string) => void
	onSend: (prompt: string, mode: ChatMode) => void
}

/**
 * Drives the website's product demo: picks the requested task, types its
 * first example as if someone were writing it, then sends it.
 */
export function useDemoPlay({
	play,
	enabled,
	onMode,
	onType,
	onSend,
}: Options) {
	const callbacks = useRef({ onMode, onType, onSend })
	callbacks.current = { onMode, onType, onSend }

	useEffect(() => {
		const mode = play?.toUpperCase()
		if (!enabled || !isChatMode(mode)) return

		const prompt = MODES[mode].examples[0] ?? ''
		const timers: Array<ReturnType<typeof setTimeout>> = []
		let typed = 0

		callbacks.current.onMode(mode)
		timers.push(
			setTimeout(() => {
				const interval = setInterval(() => {
					typed += 1
					callbacks.current.onType(prompt.slice(0, typed))
					if (typed >= prompt.length) {
						clearInterval(interval)
						timers.push(
							setTimeout(
								() => callbacks.current.onSend(prompt, mode),
								SEND_DELAY_MS,
							),
						)
					}
				}, TYPE_INTERVAL_MS)
				timers.push(interval)
			}, START_DELAY_MS),
		)

		return () => timers.forEach((timer) => clearTimeout(timer))
	}, [play, enabled])
}
