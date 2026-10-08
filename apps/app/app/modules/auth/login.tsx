import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
	useSearchParams,
} from 'react-router'
import { AuthLayout } from './auth-layout'
import { GoogleButton, OrDivider } from './google-button'
import { useEmailLinkSession } from './use-email-link-session'
import { Alert } from '~/components/arc/alert/alert'
import { Button } from '~/components/arc/button/button'
import { Input } from '~/components/arc/input/input'
import { PasswordField } from '~/components/arc/password-field/password-field'
import type { action, loader } from '~/routes/login'

export function LoginModule() {
	const { linkError } = useLoaderData<typeof loader>()
	const emailLink = useEmailLinkSession()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const [searchParams] = useSearchParams()
	const returnTo = searchParams.get('return_to')
	const submitting =
		navigation.state !== 'idle' && navigation.formAction === '/login'

	return (
		<AuthLayout
			title="Sign in to Dossier"
			description="Welcome back. Pick up where your team left off."
			switchLead="New to Dossier?"
			switchLabel="Create account"
			switchTo="/signup"
		>
			{emailLink === 'signing-in' ? (
				<Alert tone="info" title="Signing you in…">
					One moment while we open your workspace.
				</Alert>
			) : emailLink === 'expired' ? (
				<Alert tone="danger" title="That link has expired">
					Ask whoever invited you to resend the invitation, or use Forgot
					password below to get a new link.
				</Alert>
			) : emailLink === 'failed' || linkError ? (
				<Alert tone="danger" title="Couldn’t sign you in">
					{linkError ??
						'That sign-in link is invalid or has expired. Sign in, or request a new link.'}
				</Alert>
			) : null}
			{result?.field === 'form' ? (
				<Alert tone="danger" title="Couldn’t sign you in">
					{result.error}
				</Alert>
			) : null}
			<GoogleButton returnTo={returnTo} />
			<OrDivider />
			<Form method="post" className="flex flex-col gap-3.5" noValidate>
				{returnTo ? (
					<input type="hidden" name="return_to" value={returnTo} />
				) : null}
				<Input
					label="Work email"
					name="email"
					type="email"
					autoComplete="email"
					placeholder="you@company.com"
					error={result?.field === 'email' ? result.error : undefined}
				/>
				<div className="flex flex-col gap-1.5">
					<PasswordField
						label="Password"
						name="password"
						autoComplete="current-password"
						placeholder="Your password"
						aria-invalid={result?.field === 'password' || undefined}
						aria-describedby={
							result?.field === 'password' ? 'password-error' : undefined
						}
					/>
					{result?.field === 'password' ? (
						<p
							id="password-error"
							role="alert"
							className="text-danger text-[13px]"
						>
							{result.error}
						</p>
					) : null}
					<Link
						to="/forgot-password"
						className="text-accent self-end text-[13px] hover:underline"
					>
						Forgot password?
					</Link>
				</div>
				<Button
					type="submit"
					size="lg"
					loading={submitting}
					className="mt-1 w-full"
				>
					Sign in
				</Button>
			</Form>
		</AuthLayout>
	)
}
