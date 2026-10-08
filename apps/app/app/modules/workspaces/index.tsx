import { Check } from 'lucide-react'
import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from 'react-router'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import { WorkspaceMark } from '~/components/workspace-mark'
import { AuthLayout } from '~/modules/auth/auth-layout'
import type { action, loader } from '~/routes/workspaces'

const ROLE_LABELS: Record<MemberRole, string> = {
	OWNER: 'Owner',
	ADMIN: 'Admin',
	MEMBER: 'Member',
}

function useSubmitting(intent: string, id: string) {
	const navigation = useNavigation()
	return (
		navigation.state !== 'idle' &&
		navigation.formData?.get('intent') === intent &&
		[
			navigation.formData.get('invitation_id'),
			navigation.formData.get('organization_id'),
		].includes(id)
	)
}

function InvitationItem({ invitation }: { invitation: InvitationSummary }) {
	const accepting = useSubmitting('accept', invitation.id)
	const declining = useSubmitting('decline', invitation.id)

	return (
		<li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
			<WorkspaceMark name={invitation.organization_name} />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-medium">
					{invitation.organization_name}
				</span>
				<span className="text-muted truncate text-xs">
					{invitation.invited_by
						? `${invitation.invited_by} invited you`
						: 'You’re invited'}{' '}
					as {ROLE_LABELS[invitation.role].toLowerCase()}
				</span>
			</span>
			<Form method="post" className="flex gap-1.5">
				<input type="hidden" name="invitation_id" value={invitation.id} />
				<Button
					type="submit"
					name="intent"
					value="decline"
					variant="ghost"
					size="sm"
					loading={declining}
				>
					Decline
				</Button>
				<Button
					type="submit"
					name="intent"
					value="accept"
					size="sm"
					loading={accepting}
				>
					Accept
				</Button>
			</Form>
		</li>
	)
}

function WorkspaceItem({
	workspace,
	current,
}: {
	workspace: WorkspaceSummary
	current: boolean
}) {
	const opening = useSubmitting('open', workspace.id)

	return (
		<li>
			<Form method="post">
				<input type="hidden" name="intent" value="open" />
				<input type="hidden" name="organization_id" value={workspace.id} />
				<button
					type="submit"
					disabled={opening}
					className="hover:bg-surface-muted flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left"
				>
					<WorkspaceMark name={workspace.name} logoUrl={workspace.logo_url} />
					<span className="flex min-w-0 flex-1 flex-col">
						<span className="truncate text-sm font-medium">
							{workspace.name}
						</span>
						<span className="text-muted text-xs">
							{ROLE_LABELS[workspace.role]}
						</span>
					</span>
					{current ? (
						<Check
							aria-label="Current workspace"
							className="text-accent size-4"
						/>
					) : null}
				</button>
			</Form>
		</li>
	)
}

export function WorkspacesModule() {
	const { email, workspaces, invitations, currentId } =
		useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()

	return (
		<AuthLayout
			title="Your workspaces"
			description={`Signed in as ${email}.`}
			switchLead="Wrong account?"
			switchLabel="Sign out"
			switchTo="/logout"
			switchMethod="post"
		>
			<div className="flex flex-col gap-5">
				{result?.error ? (
					<Alert tone="danger" title="That didn’t work">
						{result.error}
					</Alert>
				) : null}
				{invitations.length ? (
					<section className="flex flex-col gap-2">
						<h2 className="text-secondary text-[13px]">Invitations</h2>
						<ul className="divide-border-subtle divide-y overflow-hidden rounded-[20px] border">
							{invitations.map((invitation) => (
								<InvitationItem key={invitation.id} invitation={invitation} />
							))}
						</ul>
					</section>
				) : null}
				{workspaces.length ? (
					<section className="flex flex-col gap-2">
						<h2 className="text-secondary text-[13px]">Open a workspace</h2>
						<ul className="divide-border-subtle divide-y overflow-hidden rounded-[20px] border">
							{workspaces.map((workspace) => (
								<WorkspaceItem
									key={workspace.id}
									workspace={workspace}
									current={workspace.id === currentId}
								/>
							))}
						</ul>
					</section>
				) : null}
				<Link to="/onboarding?new=1" className="text-accent self-start text-sm">
					Create another workspace
				</Link>
			</div>
		</AuthLayout>
	)
}
