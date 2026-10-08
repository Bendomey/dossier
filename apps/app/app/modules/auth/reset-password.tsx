import { CircleCheck } from 'lucide-react'
import {
	Form,
	useActionData,
	useLoaderData,
	useNavigate,
	useNavigation,
} from 'react-router'
import { AuthLayout } from './auth-layout'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import { PasswordStrength } from '~/components/arc/password-strength/password-strength'
import type { action, loader } from '~/routes/reset-password'

export function ResetPasswordModule() {
	const { email } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const navigate = useNavigate()
	const submitting =
		navigation.state !== 'idle' && navigation.formAction === '/reset-password'
	const failure = result && 'field' in result ? result : undefined

	if (result && 'updated' in result) {
		return (
			<AuthLayout
				title="Password updated"
				description="You’re signed in with your new password."
				switchLead="Not you?"
				switchLabel="Sign out"
				switchTo="/logout"
				switchMethod="post"
			>
				<EmptyState
					icon={<CircleCheck size={24} />}
					title="Your new password is set"
					description="We signed you out everywhere else, in case someone else knew the old one."
					action={
						<Button onClick={() => navigate('/')}>Continue to Dossier</Button>
					}
				/>
			</AuthLayout>
		)
	}

	return (
		<AuthLayout
			title="Choose a new password"
			description={`For ${email}.`}
			switchLead="Changed your mind?"
			switchLabel="Sign out"
			switchTo="/logout"
			switchMethod="post"
		>
			{failure?.field === 'form' ? (
				<Alert tone="danger" title="Couldn’t update your password">
					{failure.error}
				</Alert>
			) : null}
			<Form method="post" className="flex flex-col gap-3.5" noValidate>
				<input
					type="hidden"
					name="username"
					autoComplete="username"
					value={email}
					readOnly
				/>
				<PasswordStrength
					label="New password"
					name="password"
					autoComplete="new-password"
					placeholder="At least 8 characters"
					autoFocus
					error={failure?.field === 'password' ? failure.error : undefined}
				/>
				<Button
					type="submit"
					size="lg"
					loading={submitting}
					className="mt-1 w-full"
				>
					Save new password
				</Button>
			</Form>
		</AuthLayout>
	)
}
