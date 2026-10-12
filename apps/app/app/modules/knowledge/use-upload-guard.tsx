import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router'
import { warnBeforeUnload } from './warn-before-unload'
import { Button } from '~/components/arc/button/button'
import { Dialog, DialogContent } from '~/components/arc/dialog/dialog'
import { plural } from '~/lib/format'

function ConfirmLeave({
	open,
	uploading,
	onStay,
	onLeave,
}: {
	open: boolean
	uploading: number
	onStay: () => void
	onLeave: () => void
}) {
	return (
		<Dialog open={open} onOpenChange={(next) => !next && onStay()}>
			<DialogContent
				title="Uploads still in progress"
				description={`${plural(uploading, 'file is', 'files are')} still uploading. If you leave, ${uploading === 1 ? 'it' : 'they'}’ll be cancelled.`}
			>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={onStay}>
						Stay
					</Button>
					<Button variant="danger" onClick={onLeave}>
						Leave and cancel uploads
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}

/** Mounted only while uploads run, because a router supports one blocker at a time. */
function NavigationGuard({
	active,
	uploading,
	onLeave,
	onBlockedChange,
}: {
	active: boolean
	uploading: number
	onLeave: () => void
	onBlockedChange: (blocked: boolean) => void
}) {
	const blocker = useBlocker(true)
	const blocked = blocker.state === 'blocked'

	useEffect(() => {
		window.addEventListener('beforeunload', warnBeforeUnload)
		return () => window.removeEventListener('beforeunload', warnBeforeUnload)
	}, [])

	useEffect(() => {
		onBlockedChange(blocked)
	}, [blocked, onBlockedChange])

	useEffect(() => {
		if (!active && blocker.state === 'blocked') blocker.proceed()
	}, [active, blocker])

	return (
		<ConfirmLeave
			open={blocked}
			uploading={uploading}
			onStay={() => blocker.state === 'blocked' && blocker.reset()}
			onLeave={() => {
				onLeave()
				if (blocker.state === 'blocked') blocker.proceed()
			}}
		/>
	)
}

/**
 * Keeps people from leaving while files are still uploading: in-app
 * navigation and closing the dialog ask first, closing the tab gets the
 * browser’s own prompt. Leaving calls onLeave, which aborts the uploads.
 */
export function useUploadGuard(uploading: number, onLeave: () => void) {
	const active = uploading > 0
	const [navigationBlocked, setNavigationBlocked] = useState(false)
	const [pendingClose, setPendingClose] = useState<(() => void) | null>(null)

	useEffect(() => {
		if (!active && pendingClose) {
			pendingClose()
			setPendingClose(null)
		}
	}, [active, pendingClose])

	const confirmLeave = (
		<>
			{active || navigationBlocked ? (
				<NavigationGuard
					active={active}
					uploading={uploading}
					onLeave={onLeave}
					onBlockedChange={setNavigationBlocked}
				/>
			) : null}
			<ConfirmLeave
				open={pendingClose !== null}
				uploading={uploading}
				onStay={() => setPendingClose(null)}
				onLeave={() => {
					onLeave()
					pendingClose?.()
					setPendingClose(null)
				}}
			/>
		</>
	)

	return {
		confirmLeave,
		requestClose(close: () => void) {
			if (active) setPendingClose(() => close)
			else close()
		},
	}
}
