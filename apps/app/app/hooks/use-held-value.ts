import { useEffect, useState } from 'react'

/**
 * Shows a submitted value until the data catches up. A fetcher's pending value
 * disappears when its action finishes, but rows on later pages only update once
 * their page is refetched; without this they would flash back to the old value.
 * The hold ends when the data changes, the save failed, or after 5 seconds.
 */
export function useHeldValue<T>(
	pending: T | undefined,
	actual: T,
	failed = false,
): T {
	const actualKey = JSON.stringify(actual)
	const pendingKey = pending === undefined ? undefined : JSON.stringify(pending)
	const [held, setHeld] = useState<{
		key: string
		value: T
		baseline: string
	} | null>(null)

	if (pendingKey !== undefined) {
		if (held?.key !== pendingKey) {
			setHeld({ key: pendingKey, value: pending as T, baseline: actualKey })
		}
	} else if (
		held &&
		(failed || actualKey !== held.baseline || actualKey === held.key)
	) {
		setHeld(null)
	}

	useEffect(() => {
		if (!held || pendingKey !== undefined) return
		const timer = setTimeout(() => setHeld(null), 5000)
		return () => clearTimeout(timer)
	}, [held, pendingKey])

	if (pendingKey !== undefined) return pending as T
	return held ? held.value : actual
}
