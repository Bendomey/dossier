import { motion, useReducedMotion } from 'motion/react'
import { NavLink, useLocation } from 'react-router'
import { useGetOrganization } from '~/api/organization'
import { motionTokens } from '~/components/arc/lib/motion-tokens'
import { cn } from '~/lib/utils'

const TABS = [
	{ to: '/settings/organization', label: 'Organization' },
	{ to: '/settings/people', label: 'People' },
	{ to: '/settings/groups', label: 'Groups' },
	{ to: '/settings/billing', label: 'Billing' },
	{ to: '/settings/audit-log', label: 'Audit log' },
]

export function SettingsLayoutModule({
	children,
}: {
	children: React.ReactNode
}) {
	const { data: organization } = useGetOrganization()
	const { pathname } = useLocation()
	const reduced = useReducedMotion()

	return (
		<div className="flex-1 overflow-auto px-4 pt-8 pb-16 md:px-10">
			<div className="mx-auto flex max-w-[880px] flex-col gap-6">
				<div className="flex flex-col gap-1.5">
					<h1 className="font-heading text-[32px] leading-[1.1] font-medium tracking-[-0.03em]">
						Settings
					</h1>
					<p className="text-secondary text-[15px]">
						Organization, team, billing and activity for{' '}
						{(organization?.name ?? 'your workspace').replace(/\.$/, '')}.
					</p>
				</div>
				<nav
					aria-label="Settings"
					className="flex gap-1 overflow-x-auto border-b"
				>
					{TABS.map((tab) => {
						const active = pathname.startsWith(tab.to)
						return (
							<NavLink
								key={tab.to}
								to={tab.to}
								className={cn(
									'hover:text-foreground relative flex h-[42px] shrink-0 items-center px-3 text-sm whitespace-nowrap transition-colors',
									active ? 'text-foreground' : 'text-secondary',
								)}
							>
								{tab.label}
								{active ? (
									<motion.span
										layoutId="settings-tab"
										transition={
											reduced ? { duration: 0 } : motionTokens.spring.morph
										}
										className="bg-foreground absolute inset-x-2 -bottom-px h-0.5 rounded-full"
									/>
								) : null}
							</NavLink>
						)
					})}
				</nav>
				<div
					key={pathname}
					className="animate-in fade-in slide-in-from-bottom-1.5 duration-300"
				>
					{children}
				</div>
			</div>
		</div>
	)
}
