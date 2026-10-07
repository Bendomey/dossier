import { LogOut, Menu, Plus } from 'lucide-react'
import { useState } from 'react'
import { Form, Link, useNavigate } from 'react-router'

import { PrimaryNav, RecentChats, SettingsNavItem } from './sidebar-nav'
import { ThemeToggle } from './theme-toggle'
import { useGetMembers } from '~/api/members'
import { useGetOrganization } from '~/api/organization'
import { Avatar } from '~/components/arc/avatar/avatar'
import { Button } from '~/components/arc/button/button'
import { Drawer, DrawerContent } from '~/components/arc/drawer/drawer'
import { Tooltip } from '~/components/arc/tooltip/tooltip'
import { usePageTitle } from '~/hooks/use-page-title'
import { plural } from '~/lib/format'
import { useAppBase } from '~/providers/app-base-provider'
import { useAuth } from '~/providers/auth-provider'

function OrganizationBadge() {
	const { data: organization } = useGetOrganization()
	const { data: members } = useGetMembers()
	const name = organization?.name ?? ' '

	return (
		<div className="flex items-center gap-2.5 rounded-[14px] p-2">
			<span className="bg-foreground text-background grid size-7 shrink-0 place-items-center rounded-lg text-[13px] font-medium">
				{name.charAt(0)}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-medium">{name}</span>
				<span className="text-muted truncate text-xs">
					{organization ? `${organization.plan.name} plan` : ' '}
					{members ? ` · ${plural(members.length, 'member')}` : ''}
				</span>
			</span>
		</div>
	)
}

function SignOutButton({ className }: { className?: string }) {
	return (
		<Form method="post" action="/logout" className={className}>
			<Tooltip content="Sign out">
				<button
					type="submit"
					aria-label="Sign out"
					className="text-muted hover:bg-surface-muted hover:text-foreground grid size-8 cursor-pointer place-items-center rounded-[10px]"
				>
					<LogOut className="size-4" strokeWidth={1.75} />
				</button>
			</Tooltip>
		</Form>
	)
}

function Sidebar() {
	const { currentUser } = useAuth()
	const navigate = useNavigate()
	const { path, demo } = useAppBase()

	return (
		<aside className="desk:flex border-border hidden w-[264px] shrink-0 flex-col gap-1 border-r p-3">
			<OrganizationBadge />
			<Button
				variant="secondary"
				className="my-2 w-full"
				onClick={() => navigate(path('/'))}
			>
				<Plus className="size-4" strokeWidth={1.75} />
				New chat
			</Button>
			<PrimaryNav />
			<RecentChats />
			<SettingsNavItem />
			<div className="border-border-subtle mt-1 flex items-center gap-2.5 border-t p-2.5">
				<Avatar name={currentUser.name} size="sm" />
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-[13px] font-medium">
						{currentUser.name}
					</span>
					<span className="text-muted truncate text-xs">
						{currentUser.email}
					</span>
				</span>
				{demo ? null : (
					<>
						<ThemeToggle />
						<SignOutButton />
					</>
				)}
			</div>
		</aside>
	)
}

function MobileBar({ onOpenNav }: { onOpenNav: () => void }) {
	const title = usePageTitle()
	const { path } = useAppBase()

	return (
		<div className="desk:hidden border-border flex h-14 shrink-0 items-center gap-2 border-b px-3">
			<button
				type="button"
				onClick={onOpenNav}
				aria-label="Open menu"
				className="grid size-11 cursor-pointer place-items-center rounded-[14px]"
			>
				<Menu className="size-5" strokeWidth={1.75} />
			</button>
			<span className="flex-1 truncate text-[15px] font-medium">{title}</span>
			<Link
				to={path('/')}
				aria-label="New chat"
				className="grid size-11 place-items-center rounded-[14px]"
			>
				<Plus className="size-5" strokeWidth={1.75} />
			</Link>
		</div>
	)
}

function MobileNav({
	open,
	onOpenChange,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const close = () => onOpenChange(false)
	const { demo } = useAppBase()

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent side="left" title="Dossier">
				<div className="flex h-full flex-col gap-1">
					<OrganizationBadge />
					<PrimaryNav size="lg" onNavigate={close} />
					<RecentChats onNavigate={close} />
					<SettingsNavItem size="lg" onNavigate={close} />
					{demo ? null : (
						<div className="flex items-center justify-between pt-2">
							<ThemeToggle />
							<SignOutButton />
						</div>
					)}
				</div>
			</DrawerContent>
		</Drawer>
	)
}

export function AppShell({ children }: { children: React.ReactNode }) {
	const [navOpen, setNavOpen] = useState(false)

	return (
		<div className="bg-background flex h-dvh overflow-hidden">
			<Sidebar />
			<main className="relative flex min-w-0 flex-1 flex-col">
				<MobileBar onOpenNav={() => setNavOpen(true)} />
				{children}
			</main>
			<MobileNav open={navOpen} onOpenChange={setNavOpen} />
		</div>
	)
}
