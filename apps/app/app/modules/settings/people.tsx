import { useState } from 'react'
import { useGetBillingOverview } from '~/api/billing'
import { useGetGroups } from '~/api/groups'
import { useGetMembers, useInviteMember, useUpdateMember } from '~/api/members'
import { Alert } from '~/components/arc/alert/alert'
import { Avatar } from '~/components/arc/avatar/avatar'
import { Badge } from '~/components/arc/badge/badge'
import { Button } from '~/components/arc/button/button'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { NativeSelect, TextInput } from '~/components/form-controls'
import { ToggleChip } from '~/components/toggle-chip'

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

function InviteForm({ groups }: { groups: Group[] }) {
	const invite = useInviteMember()
	const assignable = groups.filter((group) => !group.is_builtin)
	const [email, setEmail] = useState('')
	const [role, setRole] = useState<InviteMemberInput['role']>('MEMBER')
	const [groupId, setGroupId] = useState(assignable[0]?.id ?? '')

	function submit(event: React.FormEvent) {
		event.preventDefault()
		invite.mutate(
			{ email, role, group_ids: role === 'MEMBER' && groupId ? [groupId] : [] },
			{ onSuccess: () => setEmail('') },
		)
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-2.5">
			<div className="flex flex-wrap gap-2">
				<TextInput
					type="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					placeholder="Invite by email"
					aria-label="Email address"
					className="min-w-[200px] flex-1"
				/>
				<NativeSelect
					aria-label="Role"
					value={role}
					onChange={(event) =>
						setRole(event.target.value as InviteMemberInput['role'])
					}
					className="w-auto"
				>
					<option value="MEMBER">Member</option>
					<option value="ADMIN">Admin</option>
				</NativeSelect>
				{role === 'MEMBER' ? (
					<NativeSelect
						aria-label="Group"
						value={groupId}
						onChange={(event) => setGroupId(event.target.value)}
						className="w-auto"
					>
						{assignable.map((group) => (
							<option key={group.id} value={group.id}>
								{group.name}
							</option>
						))}
					</NativeSelect>
				) : null}
				<Button type="submit" size="lg" loading={invite.isPending}>
					Invite
				</Button>
			</div>
			{invite.isError ? (
				<Alert tone="danger" title="Invite not sent">
					{invite.error.message}
				</Alert>
			) : invite.isSuccess ? (
				<p role="status" className="text-success text-[13px]">
					Invite sent to {invite.data.email}.
				</p>
			) : null}
		</form>
	)
}

function MemberRow({ member, groups }: { member: Member; groups: Group[] }) {
	const update = useUpdateMember()
	const [editing, setEditing] = useState(false)
	const isAdmin = member.role !== 'MEMBER'
	const assignable = groups.filter((group) => !group.is_builtin)
	const memberGroups = assignable.filter((group) =>
		member.group_ids.includes(group.id),
	)

	function toggleGroup(groupId: string) {
		update.mutate({
			memberId: member.id,
			group_ids: member.group_ids.includes(groupId)
				? member.group_ids.filter((item) => item !== groupId)
				: [...member.group_ids, groupId],
		})
	}

	return (
		<li className="border-border-subtle flex flex-col border-t first:border-t-0">
			<div className="flex flex-wrap items-center gap-3.5 px-[18px] py-3.5">
				<Avatar name={member.name} size="sm" />
				<span className="flex min-w-40 flex-1 flex-col">
					<span className="flex items-center gap-2 text-sm font-medium">
						{member.name}
						{member.invited ? (
							<Badge tone="info" size="sm">
								Invited
							</Badge>
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
							{memberGroups.map((group) => (
								<span
									key={group.id}
									className="bg-surface-muted flex h-[26px] items-center rounded-full px-2.5 text-xs"
								>
									{group.name}
								</span>
							))}
							{memberGroups.length === 0 ? (
								<span className="text-warning text-[13px]">
									No groups yet, sees Everyone documents only
								</span>
							) : null}
							<button
								type="button"
								aria-expanded={editing}
								onClick={() => setEditing(!editing)}
								className="text-accent hover:bg-accent-subtle h-[26px] cursor-pointer rounded-[10px] px-2.5 text-[13px]"
							>
								{editing ? 'Done' : 'Edit groups'}
							</button>
						</>
					)}
				</span>
				{member.role === 'OWNER' ? (
					<span className="text-secondary w-[104px] pl-2.5 text-[13px]">
						Owner
					</span>
				) : (
					<NativeSelect
						aria-label={`Role for ${member.name}`}
						value={member.role}
						onChange={(event) =>
							update.mutate({
								memberId: member.id,
								role: event.target.value as InviteMemberInput['role'],
							})
						}
						className="border-border h-[34px] w-[104px] rounded-[14px] px-2.5 text-[13px]"
					>
						<option value="ADMIN">Admin</option>
						<option value="MEMBER">Member</option>
					</NativeSelect>
				)}
			</div>
			{editing && !isAdmin ? (
				<div className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-2 pr-[18px] pb-4 pl-[66px] duration-250">
					<span className="text-secondary text-[13px]">
						Groups for {member.name}
					</span>
					<div className="flex flex-wrap gap-1.5">
						{assignable.map((group) => (
							<ToggleChip
								key={group.id}
								pressed={member.group_ids.includes(group.id)}
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

export function PeopleSettingsModule() {
	const { data: members, isPending } = useGetMembers()
	const { data: groups } = useGetGroups()
	const { data: billing } = useGetBillingOverview()

	if (isPending || !members || !groups)
		return <Skeleton avatar lines={6} label="Loading people" />

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
			<InviteForm groups={groups} />
			<p className="text-secondary text-[13px] tabular-nums">
				{members.length} of {billing?.seats.limit ?? '–'} seats used on the{' '}
				{billing?.plan_label.split(',')[0] ?? ''} plan
			</p>
			<ul className="overflow-hidden rounded-[26px] border">
				{members.map((member) => (
					<MemberRow key={member.id} member={member} groups={groups} />
				))}
			</ul>
		</div>
	)
}
