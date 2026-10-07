import { cn } from '~/lib/utils'

export function MonoLabel({
	className,
	...props
}: React.ComponentPropsWithoutRef<'div'>) {
	return (
		<div
			className={cn(
				'text-subtle font-mono text-[11px] tracking-[.06em] uppercase',
				className,
			)}
			{...props}
		/>
	)
}
