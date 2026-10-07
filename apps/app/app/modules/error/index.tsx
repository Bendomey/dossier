import { Link } from 'react-router'
import { Logo } from '~/components/layout/logo'

const COPY: Record<number, { title: string; message: string }> = {
	404: {
		title: 'Page not found',
		message: 'This page doesn’t exist or was moved.',
	},
	403: {
		title: 'No access',
		message: 'You don’t have permission to open this page.',
	},
}

export function ErrorModule({
	status = 500,
	details,
}: {
	status?: number
	details?: string
}) {
	const copy = COPY[status] ?? {
		title: 'Something went wrong',
		message: 'Try again in a moment. If it keeps happening, contact support.',
	}

	return (
		<div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
			<Logo />
			<div className="flex max-w-md flex-col gap-2">
				<p className="text-muted text-sm tabular-nums">{status}</p>
				<h1 className="font-heading text-[34px] leading-[1.1] font-medium tracking-[-0.03em]">
					{copy.title}
				</h1>
				<p className="text-secondary text-[15px]">{copy.message}</p>
				{details ? (
					<pre className="bg-surface-muted text-secondary mt-4 overflow-auto rounded-2xl p-4 text-left text-xs">
						{details}
					</pre>
				) : null}
			</div>
			<Link
				to="/"
				className="bg-foreground text-background rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-90"
			>
				Back to Dossier
			</Link>
		</div>
	)
}

export function NotFoundModule() {
	return <ErrorModule status={404} />
}
