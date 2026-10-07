import {
	BookOpen,
	MessageSquare,
	SlidersHorizontal,
	type LucideIcon,
} from 'lucide-react'
import { NavLink } from 'react-router'
import { useGetChats } from '~/api/chats'
import { useGetKnowledgeStats } from '~/api/documents'
import { cn } from '~/lib/utils'

interface Props {
	onNavigate?: () => void
	size?: 'md' | 'lg'
}

function NavItem({
	to,
	icon: Icon,
	label,
	meta,
	end,
	size,
	onNavigate,
}: {
	to: string
	icon: LucideIcon
	label: string
	meta?: string
	end?: boolean
} & Props) {
	return (
		<NavLink
			to={to}
			end={end}
			onClick={onNavigate}
			className={({ isActive }) =>
				cn(
					'hover:bg-surface-muted flex items-center gap-2.5 rounded-xl px-2.5 transition-colors',
					size === 'lg' ? 'h-11 text-[15px]' : 'h-[38px] text-sm',
					isActive && 'bg-surface-muted font-medium',
				)
			}
		>
			{({ isActive }) => (
				<>
					<Icon
						className={cn(
							'size-[18px]',
							isActive ? 'text-accent' : 'text-secondary',
						)}
						strokeWidth={1.75}
					/>
					<span className="flex-1">{label}</span>
					{meta ? (
						<span className="text-muted text-xs tabular-nums">{meta}</span>
					) : null}
				</>
			)}
		</NavLink>
	)
}

export function PrimaryNav(props: Props) {
	const { data: stats } = useGetKnowledgeStats()

	return (
		<nav aria-label="Main" className="flex flex-col gap-1">
			<NavItem to="/" end icon={MessageSquare} label="Workspace" {...props} />
			<NavItem
				to="/knowledge"
				icon={BookOpen}
				label="Knowledge"
				meta={stats ? String(stats.total) : undefined}
				{...props}
			/>
		</nav>
	)
}

export function SettingsNavItem(props: Props) {
	return (
		<NavItem
			to="/settings"
			icon={SlidersHorizontal}
			label="Settings"
			{...props}
		/>
	)
}

export function RecentChats({ onNavigate }: Props) {
	const { data: chats } = useGetChats()

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="text-muted mx-2.5 mt-5 mb-1.5 text-xs">Recent</div>
			<nav
				aria-label="Recent chats"
				className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto"
			>
				{chats?.map((chat) => (
					<NavLink
						key={chat.id}
						to={`/chats/${chat.id}`}
						onClick={onNavigate}
						className={({ isActive }) =>
							cn(
								'hover:bg-surface-muted hover:text-foreground flex h-[34px] shrink-0 items-center truncate rounded-xl px-2.5 text-[13px]',
								isActive
									? 'bg-surface-muted text-foreground'
									: 'text-secondary',
							)
						}
					>
						<span className="truncate">{chat.title}</span>
					</NavLink>
				))}
			</nav>
		</div>
	)
}
