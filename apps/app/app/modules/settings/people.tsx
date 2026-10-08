import { useEffect, useRef, useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import { Alert } from '~/components/arc/alert/alert'
import { Avatar } from '~/components/arc/avatar/avatar'
import { Badge } from '~/components/arc/badge/badge'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
} from '~/components/arc/dialog/dialog'
import { NativeSelect, TextInput } from '~/components/form-controls'
import { ToggleChip } from '~/components/toggle-chip'
import { plural } from '~/lib/format'
import { useSession } from '~/providers/session-provider'
import type { PeopleActionResult } from '~/routes/_auth.settings.people'

const ROLES: Array<{ role: MemberRole; name: string; description: string }> = [
	{
		role: 'OWNER',
		name: 'Owner',
		description: 'Billing and ownership, plus everything an admin can do.',
	},
	{
		role: 'ADMIN',
		name: 'Admin',
		description: 'Manages people, groups and all documents. Sees everything.',
	},
	{
		role: 'MEMBER',
		name: 'Member',
		description:
			'Asks, drafts and reviews using the documents their groups can see.',
	},
]

type Group = PeopleOverview['groups'][number]

function InviteForm({ groups }: { groups: Group[] }) {
	const fetcher = useFetcher<PeopleActionResult>({ key: 'invite' })
	const formRef = useRef<HTMLFormElement>(null)
	const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
	const sending = fetcher.state !== 'idle'

	useEffect(() => {
		if (fetcher.state === 'idle' && fetcher.data?.ok) formRef.current?.reset()
	}, [fetcher.state, fetcher.data])

	return (
		<fetcher.Form ref={formRef} method="post" className="flex flex-col gap-2.5">
			<input type="hidden" name="intent" value="invite" />
			<div className="flex flex-wrap gap-2">
				<TextInput
					type="email"
					name="email"
					required
					placeholder="Invite by email"
					aria-label="Email address"
					className="min-w-[200px] flex-1"
				/>
				<NativeSelect
					name="role"
					aria-label="Role"
					value={role}
					onChange={(event) =>
						setRole(event.target.value as 'ADMIN' | 'MEMBER')
					}
					className="w-auto"
				>
					<option value="MEMBER">Member</option>
					<option value="ADMIN">Admin</option>
				</NativeSelect>
				{role === 'MEMBER' && groups.length ? (
					<NativeSelect
						name="group_id"
						aria-label="Group"
						defaultValue={groups[0]?.id}
						className="w-auto"
					>
						<option value="">No group</option>
						{groups.map((group) => (
							<option key={group.id} value={group.id}>
								{group.name}
							</option>
						))}
					</NativeSelect>
				) : null}
				<Button type="submit" size="lg" loading={sending}>
					Invite
				</Button>
			</div>
			{fetcher.data?.error ? (
				<Alert tone="danger" title="Invite not sent">
					{fetcher.data.error}
				</Alert>
			) : fetcher.data?.message ? (
				<p
					role="status"
					className={
						fetcher.data.ok
							? 'text-success text-[13px]'
							: 'text-warning text-[13px]'
					}
				>
					{fetcher.data.message}
				</p>
			) : null}
		</fetcher.Form>
	)
}

function GroupChips({
	groupIds,
	groups,
}: {
	groupIds: string[]
	groups: Group[]
}) {
	const names = groups.filter((group) => groupIds.includes(group.id))
	return (
		<>
			{names.map((group) => (
				<span
					key={group.id}
					className="bg-surface-muted flex h-[26px] items-center rounded-full px-2.5 text-xs"
				>
					{group.name}
				</span>
			))}
		</>
	)
}

function RemoveMember({ member }: { member: OrganizationPerson }) {
	const removal = useFetcher<PeopleActionResult>({
		key: `remove:${member.membership_id}`,
	})

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="ghost" size="sm" aria-label={`Remove ${member.name}`}>
					Remove
				</Button>
			</DialogTrigger>
			<DialogContent
				title={`Remove ${member.name}?`}
				description={`${member.name} loses access to this workspace, its documents and chats straight away. What they created stays. You can invite them again later.`}
			>
				<removal.Form method="post" className="flex justify-end gap-2">
					<input type="hidden" name="intent" value="remove" />
					<input
						type="hidden"
						name="membership_id"
						value={member.membership_id}
					/>
					<DialogClose asChild>
						<Button variant="secondary">Cancel</Button>
					</DialogClose>
					<Button type="submit" variant="danger">
						Remove from workspace
					</Button>
				</removal.Form>
			</DialogContent>
		</Dialog>
	)
}

function MemberRow({
	member,
	groups,
}: {
	member: OrganizationPerson
	groups: Group[]
}) {
	const { can, user } = useSession()
	const fetcher = useFetcher<PeopleActionResult>({
		key: `member:${member.membership_id}`,
	})
	const [editing, setEditing] = useState(false)
	const removal = useFetcher<PeopleActionResult>({
		key: `remove:${member.membership_id}`,
	})

	const pending = fetcher.formData
	const role =
		pending?.get('intent') === 'change-role'
			? (pending.get('role') as MemberRole)
			: member.role
	const groupIds =
		pending?.get('intent') === 'set-groups'
			? (pending.getAll('group_ids') as string[])
			: member.group_ids
	const isAdmin = role !== 'MEMBER'
	const isSelf = member.user_id === user.id

	if (removal.formData || (removal.state === 'idle' && removal.data?.ok)) {
		return null
	}

	function submit(values: Record<string, string | string[]>) {
		const body = new FormData()
		body.set('membership_id', member.membership_id)
		for (const [key, value] of Object.entries(values)) {
			if (Array.isArray(value)) value.forEach((item) => body.append(key, item))
			else body.set(key, value)
		}
		void fetcher.submit(body, { method: 'post' })
	}

	function toggleGroup(groupId: string) {
		submit({
			intent: 'set-groups',
			group_ids: groupIds.includes(groupId)
				? groupIds.filter((id) => id !== groupId)
				: [...groupIds, groupId],
		})
	}

	return (
		<li className="border-border-subtle flex flex-col border-t first:border-t-0">
			<div className="flex flex-wrap items-center gap-3.5 px-[18px] py-3.5">
				<Avatar
					name={member.name}
					src={member.avatar_url ?? undefined}
					size="sm"
				/>
				<span className="flex min-w-40 flex-1 flex-col">
					<span className="flex items-center gap-2 text-sm font-medium">
						{member.name}
						{isSelf ? (
							<span className="text-muted text-xs font-normal">You</span>
						) : null}
					</span>
					<span className="text-muted truncate text-[13px]">
						{member.email}
					</span>
				</span>
				<span className="flex flex-wrap items-center gap-1.5">
					{isAdmin ? (
						<span className="text-secondary text-[13px]">All documents</span>
					) : (
						<>
							<GroupChips groupIds={groupIds} groups={groups} />
							{groupIds.length === 0 ? (
								<span className="text-warning text-[13px]">
									No groups yet, sees Everyone documents only
								</span>
							) : null}
							{can('groups.manage') && groups.length ? (
								<button
									type="button"
									aria-expanded={editing}
									onClick={() => setEditing(!editing)}
									className="text-accent hover:bg-accent-subtle h-[26px] cursor-pointer rounded-[10px] px-2.5 text-[13px]"
								>
									{editing ? 'Done' : 'Edit groups'}
								</button>
							) : null}
						</>
					)}
				</span>
				{role === 'OWNER' || !can('roles.manage') ? (
					<span className="text-secondary w-[104px] pl-2.5 text-[13px]">
						{ROLES.find((item) => item.role === role)?.name}
					</span>
				) : (
					<NativeSelect
						aria-label={`Role for ${member.name}`}
						value={role}
						onChange={(event) =>
							submit({ intent: 'change-role', role: event.target.value })
						}
						className="border-border h-[34px] w-[104px] rounded-[14px] px-2.5 text-[13px]"
					>
						<option value="ADMIN">Admin</option>
						<option value="MEMBER">Member</option>
					</NativeSelect>
				)}
				{can('members.remove') ? (
					<span className="flex w-[76px] justify-end">
						{role !== 'OWNER' && !isSelf ? (
							<RemoveMember member={member} />
						) : null}
					</span>
				) : null}
			</div>
			{(fetcher.data?.error ?? removal.data?.error) ? (
				<p
					role="alert"
					className="text-danger px-[18px] pb-3 pl-[66px] text-[13px]"
				>
					{fetcher.data?.error ?? removal.data?.error}
				</p>
			) : null}
			{editing && !isAdmin ? (
				<div className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-2 pr-[18px] pb-4 pl-[66px] duration-250">
					<span className="text-secondary text-[13px]">
						Groups for {member.name}
					</span>
					<div className="flex flex-wrap gap-1.5">
						{groups.map((group) => (
							<ToggleChip
								key={group.id}
								pressed={groupIds.includes(group.id)}
								onPressedChange={() => toggleGroup(group.id)}
							>
								{group.name}
							</ToggleChip>
						))}
					</div>
				</div>
			) : null}
		</li>
	)
}

function InvitationRow({
	invitation,
	groups,
}: {
	invitation: PendingInvitation
	groups: Group[]
}) {
	const { can } = useSession()
	const fetcher = useFetcher<PeopleActionResult>({
		key: `invitation:${invitation.id}`,
	})
	if (
		fetcher.formData?.get('intent') === 'revoke' ||
		(fetcher.state === 'idle' && fetcher.data?.ok)
	)
		return null

	return (
		<li className="border-border-subtle flex flex-col border-t first:border-t-0">
			<div className="flex flex-wrap items-center gap-3.5 px-[18px] py-3.5">
				<Avatar name={invitation.email} size="sm" />
				<span className="flex min-w-40 flex-1 flex-col">
					<span className="flex items-center gap-2 text-sm font-medium">
						{invitation.email.split('@')[0]}
						<Badge tone="info" size="sm">
							Invited
						</Badge>
					</span>
					<span className="text-muted truncate text-[13px]">
						{invitation.email}
					</span>
				</span>
				<span className="flex flex-wrap items-center gap-1.5">
					{invitation.role === 'ADMIN' ? (
						<span className="text-secondary text-[13px]">All documents</span>
					) : (
						<GroupChips groupIds={invitation.group_ids} groups={groups} />
					)}
				</span>
				<span className="text-secondary w-[104px] pl-2.5 text-[13px]">
					{invitation.role === 'ADMIN' ? 'Admin' : 'Member'}
				</span>
				{can('members.invite') ? (
					<fetcher.Form method="post">
						<input type="hidden" name="intent" value="revoke" />
						<input type="hidden" name="invitation_id" value={invitation.id} />
						<Button type="submit" variant="ghost" size="sm">
							Revoke
						</Button>
					</fetcher.Form>
				) : null}
			</div>
			{fetcher.data?.error ? (
				<p
					role="alert"
					className="text-danger px-[18px] pb-3 pl-[66px] text-[13px]"
				>
					{fetcher.data.error}
				</p>
			) : null}
		</li>
	)
}

export function PeopleSettingsModule() {
	const { members, invitations, groups } = useLoaderData() as PeopleOverview
	const { can } = useSession()
	const editableGroups = groups.filter((group) => !group.is_system)

	return (
		<div className="flex flex-col gap-5">
			<dl className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] overflow-hidden rounded-[26px] border">
				{ROLES.map((item) => (
					<div
						key={item.role}
						className="border-border-subtle flex flex-col gap-1 border-r px-5 py-4 last:border-r-0"
					>
						<dt className="flex items-center gap-2 text-sm font-medium">
							{item.name}
							<span className="text-muted text-xs font-normal tabular-nums">
								{members.filter((member) => member.role === item.role).length}
							</span>
						</dt>
						<dd className="text-secondary text-[13px] leading-[1.45]">
							{item.description}
						</dd>
					</div>
				))}
			</dl>
			<p className="text-secondary text-sm leading-normal">
				A role sets what someone can do. Groups set which documents a member can
				see. Owners and admins can see every document.
			</p>
			{can('members.invite') ? <InviteForm groups={editableGroups} /> : null}
			<p className="text-secondary text-[13px] tabular-nums">
				{plural(members.length, 'person', 'people')}
				{invitations.length
					? ` · ${plural(invitations.length, 'pending invitation')}`
					: ''}
			</p>
			<ul className="overflow-hidden rounded-[26px] border">
				{members.map((member) => (
					<MemberRow
						key={member.membership_id}
						member={member}
						groups={editableGroups}
					/>
				))}
				{invitations.map((invitation) => (
					<InvitationRow
						key={invitation.id}
						invitation={invitation}
						groups={editableGroups}
					/>
				))}
			</ul>
		</div>
	)
}
