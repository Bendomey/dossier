import { Form, useFetcher, useNavigation } from 'react-router'
import { SettingRow } from './setting-row'
import { Alert } from '~/components/arc/alert/alert'
import { Avatar } from '~/components/arc/avatar/avatar'
import { Button } from '~/components/arc/button/button'
import { TextInput } from '~/components/form-controls'
import { useAppBase } from '~/providers/app-base-provider'
import { useSession } from '~/providers/session-provider'

type ActionResult = { ok: boolean; error: string | null }

export function AccountSettingsModule() {
	const { user } = useSession()
	const { demo } = useAppBase()
	const fetcher = useFetcher<ActionResult>({ key: 'account-name' })
	const navigation = useNavigation()
	const signingOut =
		navigation.formData?.get('intent') === 'sign-out-everywhere'

	return (
		<div className="flex flex-col">
			<p aria-live="polite" className="text-muted h-5 self-end text-xs">
				{fetcher.state !== 'idle' ? 'Saving…' : fetcher.data?.ok ? 'Saved' : ''}
			</p>
			{fetcher.data?.error ? (
				<Alert tone="danger" title="Your name wasn’t saved">
					{fetcher.data.error}
				</Alert>
			) : null}

			<div className="border-border-subtle flex items-center gap-4 border-b pb-5">
				<Avatar name={user.name} src={user.avatar_url ?? undefined} size="lg" />
				<span className="flex min-w-0 flex-col">
					<span className="truncate text-[15px] font-medium">{user.name}</span>
					<span className="text-secondary truncate text-sm">{user.email}</span>
				</span>
			</div>

			<SettingRow
				label="Your name"
				description="Shown to your team and on activity."
			>
				{(labelId) => (
					<TextInput
						aria-labelledby={labelId}
						defaultValue={user.name}
						maxLength={120}
						autoComplete="name"
						onBlur={(event) => {
							const name = event.target.value.trim()
							if (name && name !== user.name) {
								void fetcher.submit({ name }, { method: 'post' })
							}
						}}
					/>
				)}
			</SettingRow>
			<SettingRow
				label="Email"
				description="Used to sign in. Contact support to change it."
			>
				{(labelId) => (
					<TextInput
						aria-labelledby={labelId}
						value={user.email}
						readOnly
						disabled
					/>
				)}
			</SettingRow>
			<SettingRow
				label="Sign out of all devices"
				description="Ends every session, including this one. Use it if a device was lost or shared."
				inline
			>
				{() => (
					<Form method="post">
						<input type="hidden" name="intent" value="sign-out-everywhere" />
						<Button
							type="submit"
							variant="danger"
							loading={signingOut}
							disabled={demo}
						>
							Sign out everywhere
						</Button>
					</Form>
				)}
			</SettingRow>
		</div>
	)
}
