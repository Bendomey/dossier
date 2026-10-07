import { Link } from 'react-router'

export function Logo() {
	return (
		<Link
			to="/"
			className="font-heading flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.02em]"
		>
			<span className="bg-foreground grid size-[22px] place-items-center rounded-md">
				<span className="bg-background size-2 rounded-[2px]" />
			</span>
			Dossier
		</Link>
	)
}
