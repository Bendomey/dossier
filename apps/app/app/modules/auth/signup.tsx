import { MailCheck } from 'lucide-react'
import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { AuthLayout } from './auth-layout'
import { GoogleButton, OrDivider } from './google-button'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import { Input } from '~/components/arc/input/input'
import { PasswordStrength } from '~/components/arc/password-strength/password-strength'
import type { action, loader } from '~/routes/signup'

export function SignupModule() {
	const { email } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const submitting =
		navigation.state !== 'idle' && navigation.formAction === '/signup'
	const failure = result && 'field' in result ? result : undefined
	const errorFor = (field: string) =>
		failure?.field === field ? failure.error : undefined

	if (result && 'checkEmail' in result) {
		return (
			<AuthLayout
				title="Check your email"
				description="One step left before your workspace is ready."
				switchLead="Already confirmed?"
				switchLabel="Sign in"
				switchTo="/login"
			>
				<EmptyState
					icon={<MailCheck size={24} />}
					title={`We sent a link to ${result.checkEmail}`}
					description="Open it on this device to confirm your email. Your workspace is created as soon as you do."
				/>
			</AuthLayout>
		)
	}

	return (
		<AuthLayout
			title="Create your workspace"
			description="Free for up to 3 people. No card required."
			switchLead="Already have an account?"
			switchLabel="Sign in"
			switchTo="/login"
		>
			{failure?.field === 'form' ? (
				<Alert tone="danger" title="Couldn’t create your account">
					{failure.error}
				</Alert>
			) : null}
			<GoogleButton returnTo={null} />
			<OrDivider />
			<Form method="post" className="flex flex-col gap-3.5" noValidate>
				<div className="grid grid-cols-2 gap-3">
					<Input
						label="Your name"
						name="name"
						autoComplete="name"
						autoFocus={Boolean(email)}
						placeholder="Ama Owusu"
						error={errorFor('name')}
					/>
					<Input
						label="Company"
						name="company"
						autoComplete="organization"
						placeholder="Asante & Co."
						error={errorFor('company')}
					/>
				</div>
				<Input
					label="Work email"
					name="email"
					type="email"
					autoComplete="email"
					placeholder="you@company.com"
					defaultValue={email}
					autoFocus={!email}
					error={errorFor('email')}
				/>
				<PasswordStrength
					label="Password"
					name="password"
					autoComplete="new-password"
					placeholder="At least 8 characters"
					error={errorFor('password')}
				/>
				<Button
					type="submit"
					size="lg"
					loading={submitting}
					className="mt-1 w-full"
				>
					Create account
				</Button>
			</Form>
		</AuthLayout>
	)
}
