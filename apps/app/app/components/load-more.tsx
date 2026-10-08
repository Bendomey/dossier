import { useEffect, useRef } from 'react'

/**
 * Sits after the last row and asks for the next page when it scrolls into
 * view (a little early, so rows are usually there before the reader is).
 */
export function LoadMore({
	as: Tag = 'div',
	hasMore,
	loading,
	onLoadMore,
	label = 'Loading more…',
}: {
	as?: 'li' | 'div'
	hasMore: boolean
	loading: boolean
	onLoadMore: () => void
	label?: string
}) {
	const ref = useRef<HTMLElement>(null)
	const latest = useRef(onLoadMore)
	latest.current = onLoadMore

	useEffect(() => {
		const node = ref.current
		if (!node || !hasMore || loading) return
		const observer = new IntersectionObserver(
			(entries) =>
				entries.some((entry) => entry.isIntersecting) && latest.current(),
			{ rootMargin: '400px 0px' },
		)
		observer.observe(node)
		return () => observer.disconnect()
	}, [hasMore, loading])

	if (!hasMore) return null
	return (
		<Tag
			ref={ref as never}
			role={loading ? 'status' : undefined}
			className="text-muted min-h-px px-5 py-3 text-center text-[13px]"
		>
			{loading ? label : null}
		</Tag>
	)
}
