import { forwardRef } from 'react'
import { cn } from '~/lib/utils'

/*
 * Bare fields for rows that already show their label beside the control
 * (settings rows, inline toolbars). Arc's Input and Select render their own
 * visible label, which would repeat it.
 */
const fieldClass =
	'border-border-strong bg-surface text-foreground hover:border-foreground/40 focus:border-foreground h-11 w-full min-w-0 rounded-[18px] border px-4 text-[15px] outline-none transition-colors disabled:opacity-60'

export const TextInput = forwardRef<
	HTMLInputElement,
	React.ComponentPropsWithoutRef<'input'>
>(function TextInput({ className, ...props }, ref) {
	return <input ref={ref} className={cn(fieldClass, className)} {...props} />
})

export const NativeSelect = forwardRef<
	HTMLSelectElement,
	React.ComponentPropsWithoutRef<'select'>
>(function NativeSelect({ className, ...props }, ref) {
	return (
		<select
			ref={ref}
			className={cn(fieldClass, 'cursor-pointer px-3.5 text-sm', className)}
			{...props}
		/>
	)
})
