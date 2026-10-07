import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher } from 'react-router'
import { Tooltip } from '~/components/arc/tooltip/tooltip'

export function ThemeToggle() {
	const fetcher = useFetcher()
	const [dark, setDark] = useState(false)

	useEffect(() => {
		setDark(document.documentElement.dataset.theme === 'dark')
	}, [])

	function toggle() {
		const next = dark ? 'light' : 'dark'
		document.documentElement.dataset.theme = next
		setDark(!dark)
		void fetcher.submit({ theme: next }, { method: 'post', action: '/theme' })
	}

	const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

	return (
		<Tooltip content={label}>
			<button
				type="button"
				onClick={toggle}
				aria-label={label}
				className="text-muted hover:bg-surface-muted hover:text-foreground grid size-8 cursor-pointer place-items-center rounded-[10px]"
			>
				{dark ? (
					<Sun className="size-4" strokeWidth={1.75} />
				) : (
					<Moon className="size-4" strokeWidth={1.75} />
				)}
			</button>
		</Tooltip>
	)
}
