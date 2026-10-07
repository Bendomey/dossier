import { useId } from 'react'

interface Props {
	label: string
	description: string
	children: (labelId: string) => React.ReactNode
	inline?: boolean
}

export function SettingRow({ label, description, children, inline }: Props) {
	const labelId = useId()

	return (
		<div
			className={
				inline
					? 'border-border-subtle flex items-center gap-6 border-b py-5'
					: 'border-border-subtle grid gap-x-8 gap-y-2 border-b py-5 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]'
			}
		>
			<span className="flex flex-1 flex-col gap-0.5">
				<span id={labelId} className="text-sm font-medium">
					{label}
				</span>
				<span className="text-secondary text-[13px]">{description}</span>
			</span>
			{children(labelId)}
		</div>
	)
}
