import {
	Form,
	useActionData,
	useNavigation,
	useSearchParams,
} from 'react-router'
import { AuthLayout } from './auth-layout'
import { GoogleButton, OrDivider } from './google-button'
import { Button } from '~/components/arc/button/button'
import { Input } from '~/components/arc/input/input'
import { PasswordField } from '~/components/arc/password-field/password-field'
import type { action } from '~/routes/login'

export function LoginModule() {
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
					<a
						href="#"
						className="text-accent self-end text-[13px] hover:underline"
					>
						Forgot password?
					</a>
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
