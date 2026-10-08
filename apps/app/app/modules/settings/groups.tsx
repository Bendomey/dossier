import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
} from '~/components/arc/dialog/dialog'
import { TextInput } from '~/components/form-controls'
import { ToggleChip } from '~/components/toggle-chip'
import { plural } from '~/lib/format'
import { cn } from '~/lib/utils'
import { useSession } from '~/providers/session-provider'
import type { GroupsActionResult } from '~/routes/_auth.settings.groups'

type GroupItem = GroupsOverview['groups'][number]

/**
 * One chip with its own fetcher, so toggling several chips quickly never
 * cancels an earlier save. Shows the pending value until the server answers.
 */
function SavingChip({
	fetcherKey,
	pressed,
	fields,
	valueField,
	disabled,
	children,
}: {
	fetcherKey: string
	pressed: boolean
	fields: Record<string, string>
	valueField: string
	disabled?: boolean
	children: React.ReactNode
}) {
	const fetcher = useFetcher<GroupsActionResult>({ key: fetcherKey })
	const pending = fetcher.formData?.get(valueField)
	const shown = pending == null ? pressed : pending === 'true'

	return (
		<span className="inline-flex flex-col items-start gap-1">
			<ToggleChip
				pressed={shown}
				disabled={disabled}
				onPressedChange={(next) =>
					fetcher.submit(
						{ ...fields, [valueField]: String(next) },
						{ method: 'post' },
					)
				}
			>
				{children}
			</ToggleChip>
			{fetcher.state === 'idle' && fetcher.data?.error ? (
				<span role="alert" className="text-danger max-w-48 text-xs">
					{fetcher.data.error}
				</span>
			) : null}
		</span>
	)
}

function RenameField({ group }: { group: GroupItem }) {
	const fetcher = useFetcher<GroupsActionResult>({
		key: `group-rename:${group.id}`,
	})

	return (
		<label className="text-secondary flex max-w-[360px] flex-col gap-1.5 text-[13px]">
			Name
			<TextInput
				defaultValue={group.name}
				maxLength={80}
				className="h-10 rounded-2xl text-sm"
				onBlur={(event) => {
					const name = event.target.value.trim()
					if (name && name !== group.name) {
						void fetcher.submit(
							{ intent: 'rename', group_id: group.id, name },
							{ method: 'post' },
						)
					}
				}}
			/>
			{fetcher.state === 'idle' && fetcher.data?.error ? (
				<span role="alert" className="text-danger text-xs">
					{fetcher.data.error}
				</span>
			) : null}
		</label>
	)
}

function DeleteGroup({ group }: { group: GroupItem }) {
	const fetcher = useFetcher<GroupsActionResult>({
		key: `group-delete:${group.id}`,
	})

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="danger" className="self-start">
					Delete group
				</Button>
			</DialogTrigger>
			<DialogContent
				title={`Delete ${group.name}?`}
				description="Its members stay in the workspace but lose access to documents shared only with this group."
			>
				<fetcher.Form method="post" className="flex justify-end gap-2">
					<input type="hidden" name="intent" value="delete" />
					<input type="hidden" name="group_id" value={group.id} />
					<DialogClose asChild>
						<Button variant="secondary">Cancel</Button>
					</DialogClose>
					<Button type="submit" variant="danger">
						Delete group
					</Button>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	)
}

function GroupRow({
	group,
	open,
	onToggle,
}: {
	group: GroupItem
	open: boolean
	onToggle: () => void
}) {
	const { members, collections } = useLoaderData() as GroupsOverview
	const { can } = useSession()
	const deletion = useFetcher<GroupsActionResult>({
		key: `group-delete:${group.id}`,
	})
	const canManageGroups = can('groups.manage')
	const canManageAccess = can('collections.manage')

	if (deletion.formData || (deletion.state === 'idle' && deletion.data?.ok))
		return null

	const visibleCollections = collections.filter((collection) =>
		group.collection_ids.includes(collection.id),
	)
	const summary = `${
		group.is_system
			? `All ${plural(members.length, 'person', 'people')}`
			: plural(group.membership_ids.length, 'person', 'people')
	} · ${
		visibleCollections.length
			? visibleCollections.map((collection) => collection.name).join(', ')
			: 'No collections yet'
	}`
	const panelId = `group-${group.id}`
	const assignable = members.filter((member) => member.role === 'MEMBER')

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
						{group.is_system ? (
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
					{deletion.data?.error ? (
						<Alert tone="danger" title="Group not deleted">
							{deletion.data.error}
						</Alert>
					) : null}
					{group.is_system ? (
						<p className="text-secondary text-sm">
							Everyone in the workspace is in this group, including new people.
						</p>
					) : (
						<>
							{canManageGroups ? <RenameField group={group} /> : null}
							<div className="flex flex-col gap-2">
								<span className="text-secondary text-[13px]">Members</span>
								{assignable.length ? (
									<div className="flex flex-wrap gap-1.5">
										{assignable.map((member) => (
											<SavingChip
												key={member.membership_id}
												fetcherKey={`group-member:${group.id}:${member.membership_id}`}
												pressed={group.membership_ids.includes(
													member.membership_id,
												)}
												fields={{
													intent: 'member',
													group_id: group.id,
													membership_id: member.membership_id,
												}}
												valueField="included"
												disabled={!canManageGroups}
											>
												{member.name}
											</SavingChip>
										))}
									</div>
								) : (
									<p className="text-muted text-[13px]">
										Only members can be added. Owners and admins already see
										every document.
									</p>
								)}
							</div>
						</>
					)}
					<div className="flex flex-col gap-2">
						<span className="text-secondary text-[13px]">
							Collections this group can see
						</span>
						{collections.length ? (
							<div className="flex flex-wrap gap-1.5">
								{collections.map((collection) => (
									<SavingChip
										key={collection.id}
										fetcherKey={`group-collection:${group.id}:${collection.id}`}
										pressed={group.collection_ids.includes(collection.id)}
										fields={{
											intent: 'collection',
											group_id: group.id,
											collection_id: collection.id,
										}}
										valueField="visible"
										disabled={!canManageAccess}
									>
										{collection.name}
									</SavingChip>
								))}
							</div>
						) : (
							<p className="text-muted text-[13px]">
								No collections yet. Collections you create in Knowledge appear
								here.
							</p>
						)}
					</div>
					{group.is_system || !canManageGroups ? null : (
						<DeleteGroup group={group} />
					)}
				</div>
			) : null}
		</li>
	)
}

export function GroupsSettingsModule() {
	const { groups } = useLoaderData() as GroupsOverview
	const { can } = useSession()
	const creation = useFetcher<GroupsActionResult>({ key: 'group-create' })
	const [openGroupId, setOpenGroupId] = useState<string | null>(null)

	useEffect(() => {
		if (creation.state === 'idle' && creation.data?.group_id) {
			setOpenGroupId(creation.data.group_id)
		}
	}, [creation.state, creation.data])

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end gap-4">
				<p className="text-secondary min-w-60 flex-1 text-sm leading-normal">
					Give a group access to collections. Every document follows its
					collection unless it has its own access set in Knowledge.
				</p>
				{can('groups.manage') ? (
					<creation.Form method="post">
						<input type="hidden" name="intent" value="create" />
						<Button type="submit" loading={creation.state !== 'idle'}>
							New group
						</Button>
					</creation.Form>
				) : null}
			</div>
			{creation.state === 'idle' && creation.data?.error ? (
				<Alert tone="danger" title="Group not created">
					{creation.data.error}
				</Alert>
			) : null}
			<ul className="overflow-hidden rounded-[26px] border">
				{groups.map((group) => (
					<GroupRow
						key={group.id}
						group={group}
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
