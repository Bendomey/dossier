import { cn } from '~/lib/utils'

interface Props {
	pressed: boolean
	onPressedChange: (pressed: boolean) => void
	children: React.ReactNode
	disabled?: boolean
}

/** A pill that toggles one value in a set, such as a group a member belongs to. */
export function ToggleChip({
	pressed,
	onPressedChange,
	children,
	disabled,
}: Props) {
	return (
		<button
			type="button"
			aria-pressed={pressed}
			disabled={disabled}
			onClick={() => onPressedChange(!pressed)}
			className={cn(
				'h-8 cursor-pointer rounded-full border px-3 text-[13px] transition-[background-color,border-color,color] disabled:cursor-default disabled:opacity-60',
				pressed
					? 'border-foreground bg-foreground text-background'
					: 'border-border bg-surface text-secondary hover:border-border-strong',
			)}
		>
			{children}
		</button>
	)
}
