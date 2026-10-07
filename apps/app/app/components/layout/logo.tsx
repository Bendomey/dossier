import { cn } from '~/lib/utils'

export function LogoMark({ className }: { className?: string }) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				'bg-foreground grid size-[22px] shrink-0 place-items-center rounded-md',
				className,
			)}
		>
			<span className="bg-background size-[36%] rounded-[2px]" />
		</span>
	)
}

export function Logo({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				'font-heading flex items-center gap-2.5 text-[19px] font-medium tracking-[-0.02em]',
				className,
			)}
		>
			<LogoMark />
			Dossier
		</span>
	)
}
