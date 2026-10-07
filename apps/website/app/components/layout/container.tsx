import { cn } from '~/lib/utils'

export function Container({
	className,
	...props
}: React.ComponentPropsWithoutRef<'div'>) {
	return (
		<div
			className={cn('mx-auto max-w-[1200px] px-5 md:px-8', className)}
			{...props}
		/>
	)
}
