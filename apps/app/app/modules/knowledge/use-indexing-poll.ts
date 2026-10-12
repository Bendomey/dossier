import { useEffect, useRef } from 'react'
import { useRevalidator } from 'react-router'

const POLL_MS = 10_000

/** Revalidates every 10 seconds while something is indexing and the tab is visible. */
export function useIndexingPoll(active: boolean) {
	const { revalidate, state } = useRevalidator()
	const stateRef = useRef(state)
	stateRef.current = state

	useEffect(() => {
		if (!active) return
		const tick = () => {
			if (
				document.visibilityState === 'visible' &&
				stateRef.current === 'idle'
			) {
				void revalidate()
			}
		}
		const timer = window.setInterval(tick, POLL_MS)
		document.addEventListener('visibilitychange', tick)
		return () => {
			window.clearInterval(timer)
			document.removeEventListener('visibilitychange', tick)
		}
	}, [active, revalidate])
}
