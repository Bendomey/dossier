import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
	Archive,
	BookOpen,
	MessageSquare,
	MoreHorizontal,
	Pencil,
	SlidersHorizontal,
	type LucideIcon,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router'
import { useArchiveChat, useGetChats, useRenameChat } from '~/api/chats'
import { useGetKnowledgeStats } from '~/api/documents'
import { Button } from '~/components/arc/button/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
} from '~/components/arc/dialog/dialog'
import { Input } from '~/components/arc/input/input'
import { LoadMore } from '~/components/load-more'
import { cn } from '~/lib/utils'
import { useAppBase } from '~/providers/app-base-provider'
import { useSession } from '~/providers/session-provider'

const TITLE_MAX = 100

const MENU_ITEM =
	'flex cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-surface-muted'

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
	const { path, demo } = useAppBase()
	const { organization } = useSession()
	const { data: stats } = useGetKnowledgeStats({ enabled: demo })
	const documentCount = demo ? stats?.total : organization.document_count

	return (
		<nav aria-label="Main" className="flex flex-col gap-1">
			<NavItem
				to={path('/')}
				end
				icon={MessageSquare}
				label="Workspace"
				{...props}
			/>
			<NavItem
				to={path('/knowledge')}
				icon={BookOpen}
				label="Knowledge"
				meta={documentCount === undefined ? undefined : String(documentCount)}
				{...props}
			/>
		</nav>
	)
}

export function SettingsNavItem(props: Props) {
	const { path } = useAppBase()
	return (
		<NavItem
			to={path('/settings')}
			icon={SlidersHorizontal}
			label="Settings"
			{...props}
		/>
	)
}

export function RecentChats({ onNavigate }: Props) {
	const {
		data: chats,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	} = useGetChats()
	const [renaming, setRenaming] = useState<{
		chat: ChatSummary
		open: boolean
		attempt: number
	} | null>(null)

	if (!chats?.length) return <div className="min-h-0 flex-1" />

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="text-muted mx-2.5 mt-5 mb-1.5 text-xs">Recent</div>
			<nav
				aria-label="Recent chats"
				className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto"
			>
				{chats.map((chat) => (
					<RecentChat
						key={chat.id}
						chat={chat}
						onNavigate={onNavigate}
						onRename={() =>
							setRenaming((previous) => ({
								chat,
								open: true,
								attempt: (previous?.attempt ?? 0) + 1,
							}))
						}
					/>
				))}
				<LoadMore
					hasMore={hasNextPage}
					loading={isFetchingNextPage}
					onLoadMore={() => void fetchNextPage()}
				/>
			</nav>
			<Dialog
				open={renaming?.open ?? false}
				onOpenChange={(open) =>
					setRenaming((previous) => previous && { ...previous, open })
				}
			>
				<DialogContent
					title="Rename chat"
					description="Keep it short and recognizable"
				>
					{renaming ? (
						<RenameChatForm
							key={renaming.attempt}
							chat={renaming.chat}
							onDone={() =>
								setRenaming(
									(previous) => previous && { ...previous, open: false },
								)
							}
						/>
					) : null}
				</DialogContent>
			</Dialog>
		</div>
	)
}

function RecentChat({
	chat,
	onNavigate,
	onRename,
}: {
	chat: ChatSummary
	onNavigate?: () => void
	onRename: () => void
}) {
	const { path } = useAppBase()
	const navigate = useNavigate()
	const { chatId } = useParams()
	const archive = useArchiveChat()
	const current = chatId === chat.id

	return (
		<div className="group relative flex shrink-0 items-center">
			<NavLink
				to={path(`/chats/${chat.id}`)}
				onClick={onNavigate}
				className={({ isActive }) =>
					cn(
						'hover:bg-surface-muted hover:text-foreground flex h-[34px] min-w-0 flex-1 items-center rounded-xl pr-9 pl-2.5 text-[13px]',
						isActive ? 'bg-surface-muted text-foreground' : 'text-secondary',
					)
				}
			>
				<span className="truncate">{chat.title}</span>
			</NavLink>
			{/* Not modal: the rename dialog opens from it, and a modal menu would keep the page inert under the dialog. */}
			<DropdownMenu.Root modal={false}>
				<DropdownMenu.Trigger
					aria-label={`Options for ${chat.title}`}
					className={cn(
						'text-muted hover:text-foreground data-[state=open]:text-foreground absolute right-1 grid size-7 cursor-pointer place-items-center rounded-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100',
						current && 'opacity-100',
					)}
				>
					<MoreHorizontal className="size-4" strokeWidth={1.75} />
				</DropdownMenu.Trigger>
				<DropdownMenu.Portal>
					<DropdownMenu.Content
						align="start"
						sideOffset={6}
						className="bg-surface-raised border-border animate-in fade-in zoom-in-95 z-50 flex min-w-[180px] flex-col gap-0.5 rounded-[18px] border p-1.5 shadow-[var(--shadow-floating)] duration-150"
					>
						<DropdownMenu.Item className={MENU_ITEM} onSelect={onRename}>
							<Pencil className="size-4" strokeWidth={1.75} />
							Rename
						</DropdownMenu.Item>
						<DropdownMenu.Item
							className={MENU_ITEM}
							onSelect={() =>
								archive.mutate(chat.id, {
									onSuccess: () => {
										if (current) void navigate(path('/'))
									},
								})
							}
						>
							<Archive className="size-4" strokeWidth={1.75} />
							Archive
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
		</div>
	)
}

function RenameChatForm({
	chat,
	onDone,
}: {
	chat: ChatSummary
	onDone: () => void
}) {
	const rename = useRenameChat()
	const [title, setTitle] = useState(chat.title)
	const trimmed = title.trim()

	function submit(event: FormEvent) {
		event.preventDefault()
		if (!trimmed) return
		if (trimmed === chat.title) return onDone()
		rename.mutate({ chatId: chat.id, title: trimmed }, { onSuccess: onDone })
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-4">
			<Input
				label="Title"
				value={title}
				onChange={(event) => setTitle(event.target.value)}
				onFocus={(event) => event.currentTarget.select()}
				maxLength={TITLE_MAX}
				autoFocus
				autoComplete="off"
				error={rename.isError ? rename.error.message : undefined}
			/>
			<div className="flex justify-end gap-2">
				<DialogClose asChild>
					<Button type="button" variant="secondary">
						Cancel
					</Button>
				</DialogClose>
				<Button type="submit" loading={rename.isPending} disabled={!trimmed}>
					Save
				</Button>
			</div>
		</form>
	)
}
