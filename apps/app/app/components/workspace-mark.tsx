import { cn } from '~/lib/utils'

/** A workspace's logo, or its initial when it has none. */
export function WorkspaceMark({
	name,
	logoUrl,
	className,
}: {
	name: string
	logoUrl?: string | null
	className?: string
}) {
	return logoUrl ? (
		<img
			src={logoUrl}
			alt=""
			className={cn('size-7 shrink-0 rounded-lg object-cover', className)}
		/>
	) : (
		<span
			aria-hidden
			className={cn(
				'bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-lg text-[13px] font-medium',
				className,
			)}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	)
}
