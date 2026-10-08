import { MailCheck } from 'lucide-react'
import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { AuthLayout } from './auth-layout'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import { EmptyState } from '~/components/arc/empty-state/empty-state'
import { Input } from '~/components/arc/input/input'
import type { action, loader } from '~/routes/forgot-password'

export function ForgotPasswordModule() {
	const { expired } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const submitting =
		navigation.state !== 'idle' && navigation.formAction === '/forgot-password'
	const failure = result && 'field' in result ? result : undefined

	if (result && 'sent' in result) {
		return (
			<AuthLayout
				title="Check your email"
				description="Follow the link to choose a new password."
				switchLead="Remembered it?"
				switchLabel="Sign in"
				switchTo="/login"
			>
				<EmptyState
					icon={<MailCheck size={24} />}
					title={`If ${result.sent} has an account, a reset link is on its way`}
					description="Open it on this device. The link works once and expires after an hour."
				/>
			</AuthLayout>
		)
	}

	return (
		<AuthLayout
			title="Reset your password"
			description="Enter your work email and we’ll send you a link to choose a new one."
			switchLead="Remembered it?"
			switchLabel="Sign in"
			switchTo="/login"
		>
			{expired ? (
				<Alert tone="warning" title="That reset link has expired">
					Request a new one below. Each link works once.
				</Alert>
			) : null}
			{failure?.field === 'form' ? (
				<Alert tone="danger" title="Couldn’t send the link">
					{failure.error}
				</Alert>
			) : null}
			<Form method="post" className="flex flex-col gap-3.5" noValidate>
				<Input
					label="Work email"
					name="email"
					type="email"
					autoComplete="email"
					placeholder="you@company.com"
					autoFocus
					error={failure?.field === 'email' ? failure.error : undefined}
				/>
				<Button
					type="submit"
					size="lg"
					loading={submitting}
					className="mt-1 w-full"
				>
					Send reset link
				</Button>
			</Form>
		</AuthLayout>
	)
}
