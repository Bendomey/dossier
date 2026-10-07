import {
	Briefcase,
	Building2,
	Scale,
	Users,
	type LucideProps,
} from 'lucide-react'

const ICONS = {
	scale: Scale,
	people: Users,
	building: Building2,
	briefcase: Briefcase,
}

export function CollectionIcon({
	icon,
	...props
}: { icon: Collection['icon'] } & LucideProps) {
	const Icon = ICONS[icon]
	return <Icon strokeWidth={1.75} {...props} />
}
