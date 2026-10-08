import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronsUpDown, Mail, Plus } from 'lucide-react'
import { Link, useSubmit } from 'react-router'
import { WorkspaceMark } from '~/components/workspace-mark'
import { plural } from '~/lib/format'
import { useAppBase } from '~/providers/app-base-provider'
import { useSession } from '~/providers/session-provider'

const ROLE_LABELS: Record<MemberRole, string> = {
	OWNER: 'Owner',
	ADMIN: 'Admin',
	MEMBER: 'Member',
}

const ITEM =
	'flex cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted'

function CurrentWorkspace({ interactive }: { interactive: boolean }) {
	const { organization, user, invitations } = useSession()
	return (
		<>
			<WorkspaceMark name={organization.name} logoUrl={organization.logo_url} />
			<span className="flex min-w-0 flex-1 flex-col text-left">
				<span className="truncate text-sm font-medium">
					{organization.name}
				</span>
				<span className="text-muted truncate text-xs">
					{ROLE_LABELS[user.role]} ·{' '}
					{plural(organization.member_count, 'member')}
				</span>
			</span>
			{interactive ? (
				<span className="relative">
					<ChevronsUpDown className="text-muted size-4" strokeWidth={1.75} />
					{invitations.length ? (
						<span className="bg-accent ring-background absolute -top-1 -right-1 size-2 rounded-full ring-2" />
					) : null}
				</span>
			) : null}
		</>
	)
}

/**
 * The workspace at the top of the sidebar. It becomes a switcher once there is
 * something to switch to: another workspace or an invitation.
 */
export function WorkspaceSwitcher() {
	const { organization, workspaces, invitations } = useSession()
	const { demo } = useAppBase()
	const submit = useSubmit()

	if (demo || (workspaces.length <= 1 && !invitations.length)) {
		return (
			<div className="flex items-center gap-2.5 rounded-[14px] p-2">
				<CurrentWorkspace interactive={false} />
			</div>
		)
	}

	const open = (organizationId: string) =>
		submit(
			{ intent: 'open', organization_id: organizationId },
			{ method: 'post', action: '/workspaces' },
		)

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger
				aria-label={`Switch workspace, current: ${organization.name}${invitations.length ? `, ${plural(invitations.length, 'invitation')} waiting` : ''}`}
				className="hover:bg-surface-muted data-[state=open]:bg-surface-muted flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] p-2"
			>
				<CurrentWorkspace interactive />
			</DropdownMenu.Trigger>
			<DropdownMenu.Portal>
				<DropdownMenu.Content
					align="start"
					sideOffset={6}
					className="bg-surface-raised border-border animate-in fade-in zoom-in-95 z-50 flex w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] flex-col gap-0.5 rounded-[18px] border p-1.5 shadow-[var(--shadow-floating)] duration-150"
				>
					<DropdownMenu.Label className="text-muted px-2.5 pt-1.5 pb-1 text-xs">
						Workspaces
					</DropdownMenu.Label>
					{workspaces.map((workspace) => (
						<DropdownMenu.Item
							key={workspace.id}
							className={ITEM}
							onSelect={() =>
								workspace.id !== organization.id && open(workspace.id)
							}
						>
							<WorkspaceMark
								name={workspace.name}
								logoUrl={workspace.logo_url}
								className="size-6 text-xs"
							/>
							<span className="flex min-w-0 flex-1 flex-col">
								<span className="truncate">{workspace.name}</span>
								<span className="text-muted text-xs">
									{ROLE_LABELS[workspace.role]}
								</span>
							</span>
							{workspace.id === organization.id ? (
								<Check
									aria-label="Current workspace"
									className="text-accent size-4"
								/>
							) : null}
						</DropdownMenu.Item>
					))}
					{invitations.length ? (
						<>
							<DropdownMenu.Separator className="bg-border-subtle mx-1 my-1 h-px" />
							<DropdownMenu.Item asChild className={ITEM}>
								<Link to="/workspaces">
									<Mail className="text-accent size-4" strokeWidth={1.75} />
									<span className="flex-1">
										{invitations.length === 1
											? `Invitation to ${invitations[0]!.organization_name}`
											: `${plural(invitations.length, 'invitation')} waiting`}
									</span>
									<span className="text-accent text-xs">Review</span>
								</Link>
							</DropdownMenu.Item>
						</>
					) : null}
					<DropdownMenu.Separator className="bg-border-subtle mx-1 my-1 h-px" />
					<DropdownMenu.Item asChild className={ITEM}>
						<Link to="/onboarding?new=1">
							<Plus className="text-muted size-4" strokeWidth={1.75} />
							Create another workspace
						</Link>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Portal>
		</DropdownMenu.Root>
	)
}
