import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useGetCollections, useSetCollectionGroups } from '~/api/collections'
import {
	useCreateGroup,
	useDeleteGroup,
	useGetGroups,
	useRenameGroup,
} from '~/api/groups'
import { useGetMembers, useUpdateMember } from '~/api/members'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
} from '~/components/arc/dialog/dialog'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { TextInput } from '~/components/form-controls'
import { ToggleChip } from '~/components/toggle-chip'
import { plural } from '~/lib/format'
import { cn } from '~/lib/utils'

interface GroupRowProps {
	group: Group
	members: Member[]
	collections: Collection[]
	open: boolean
	onToggle: () => void
}

function GroupRow({
	group,
	members,
	collections,
	open,
	onToggle,
}: GroupRowProps) {
	const renameGroup = useRenameGroup()
	const deleteGroup = useDeleteGroup()
	const updateMember = useUpdateMember()
	const setCollectionGroups = useSetCollectionGroups()

	const groupMembers = group.is_builtin
		? members
		: members.filter((member) => member.group_ids.includes(group.id))
	const visibleCollections = collections.filter((collection) =>
		collection.group_ids.includes(group.id),
	)
	const summary = `${group.is_builtin ? `All ${members.length} people` : plural(groupMembers.length, 'person', 'people')} · ${
		visibleCollections.length
			? visibleCollections.map((collection) => collection.name).join(', ')
			: 'No collections yet'
	}`
	const panelId = `group-${group.id}`

	return (
		<li className="border-border-subtle border-t first:border-t-0">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={onToggle}
				className="hover:bg-surface-muted flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left"
			>
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					<span className="flex items-center gap-2 text-[15px] font-medium">
						{group.name}
						{group.is_builtin ? (
							<span className="text-muted text-xs font-normal">Built in</span>
						) : null}
					</span>
					<span className="text-secondary truncate text-[13px]">{summary}</span>
				</span>
				<ChevronDown
					className={cn(
						'text-muted size-4 shrink-0 transition-transform duration-300',
						open && 'rotate-180',
					)}
					strokeWidth={1.75}
				/>
			</button>
			{open ? (
				<div
					id={panelId}
					className="animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-[18px] px-5 pt-1 pb-5 duration-250"
				>
					{group.is_builtin ? (
						<p className="text-secondary text-sm">
							Everyone in the workspace is in this group, including new people.
						</p>
					) : (
						<>
							<label className="text-secondary flex max-w-[360px] flex-col gap-1.5 text-[13px]">
								Name
								<TextInput
									defaultValue={group.name}
									className="h-10 rounded-2xl text-sm"
									onBlur={(event) => {
										const name = event.target.value.trim()
										if (name && name !== group.name)
											renameGroup.mutate({ groupId: group.id, name })
									}}
								/>
							</label>
							<div className="flex flex-col gap-2">
								<span className="text-secondary text-[13px]">Members</span>
								<div className="flex flex-wrap gap-1.5">
									{members
										.filter((member) => member.role === 'MEMBER')
										.map((member) => {
											const inGroup = member.group_ids.includes(group.id)
											return (
												<ToggleChip
													key={member.id}
													pressed={inGroup}
													onPressedChange={() =>
														updateMember.mutate({
															memberId: member.id,
															group_ids: inGroup
																? member.group_ids.filter(
																		(item) => item !== group.id,
																	)
																: [...member.group_ids, group.id],
														})
													}
												>
													{member.name}
												</ToggleChip>
											)
										})}
								</div>
							</div>
						</>
					)}
					<div className="flex flex-col gap-2">
						<span className="text-secondary text-[13px]">
							Collections this group can see
						</span>
						<div className="flex flex-wrap gap-1.5">
							{collections.map((collection) => {
								const visible = collection.group_ids.includes(group.id)
								return (
									<ToggleChip
										key={collection.id}
										pressed={visible}
										onPressedChange={() =>
											setCollectionGroups.mutate({
												collectionId: collection.id,
												groupIds: visible
													? collection.group_ids.filter(
															(item) => item !== group.id,
														)
													: [...collection.group_ids, group.id],
											})
										}
									>
										{collection.name}
									</ToggleChip>
								)
							})}
						</div>
					</div>
					{group.is_builtin ? null : (
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="danger" className="self-start">
									Delete group
								</Button>
							</DialogTrigger>
							<DialogContent
								title={`Delete ${group.name}?`}
								description="Its members lose access to documents shared only with this group."
							>
								<div className="flex justify-end gap-2">
									<DialogClose asChild>
										<Button variant="secondary">Cancel</Button>
									</DialogClose>
									<Button
										variant="danger"
										loading={deleteGroup.isPending}
										onClick={() => deleteGroup.mutate(group.id)}
									>
										Delete group
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					)}
				</div>
			) : null}
		</li>
	)
}

export function GroupsSettingsModule() {
	const { data: groups, isPending } = useGetGroups()
	const { data: members } = useGetMembers()
	const { data: collections } = useGetCollections()
	const createGroup = useCreateGroup()
	const [openGroupId, setOpenGroupId] = useState<string | null>(null)

	if (isPending || !groups || !members || !collections) {
		return <Skeleton lines={6} label="Loading groups" />
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-4">
				<p className="text-secondary min-w-60 flex-1 text-sm leading-normal">
					Give a group access to collections. Every document follows its
					collection unless it has its own access set in Knowledge.
				</p>
				<Button
					loading={createGroup.isPending}
					onClick={() =>
						createGroup.mutate('New group', {
							onSuccess: (group) => setOpenGroupId(group.id),
						})
					}
				>
					New group
				</Button>
			</div>
			<ul className="overflow-hidden rounded-[26px] border">
				{groups.map((group) => (
					<GroupRow
						key={group.id}
						group={group}
						members={members}
						collections={collections}
						open={openGroupId === group.id}
						onToggle={() =>
							setOpenGroupId(openGroupId === group.id ? null : group.id)
						}
					/>
				))}
			</ul>
		</div>
	)
}
