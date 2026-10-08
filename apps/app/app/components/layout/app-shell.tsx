import { LogOut, Menu, Plus } from 'lucide-react'
import { useState } from 'react'
import { Form, Link, useNavigate } from 'react-router'

import { PrimaryNav, RecentChats, SettingsNavItem } from './sidebar-nav'
import { ThemeToggle } from './theme-toggle'
import { WorkspaceSwitcher } from './workspace-switcher'
import { Avatar } from '~/components/arc/avatar/avatar'
import { Button } from '~/components/arc/button/button'
import { Drawer, DrawerContent } from '~/components/arc/drawer/drawer'
import { Tooltip } from '~/components/arc/tooltip/tooltip'
import { usePageTitle } from '~/hooks/use-page-title'
import { useAppBase } from '~/providers/app-base-provider'
import { useSession } from '~/providers/session-provider'

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
	const { user } = useSession()
	const navigate = useNavigate()
	const { path, demo } = useAppBase()

	return (
		<aside className="desk:flex border-border hidden w-[264px] shrink-0 flex-col gap-1 border-r p-3">
			<WorkspaceSwitcher />
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
				<Link
					to={path('/settings/account')}
					className="hover:bg-surface-muted -m-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5"
				>
					<Avatar
						name={user.name}
						src={user.avatar_url ?? undefined}
						size="sm"
					/>
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-[13px] font-medium">
							{user.name}
						</span>
						<span className="text-muted truncate text-xs">{user.email}</span>
					</span>
				</Link>
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
					<WorkspaceSwitcher />
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
