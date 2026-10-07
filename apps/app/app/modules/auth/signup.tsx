import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { AuthLayout } from './auth-layout'
import { GoogleButton, OrDivider } from './google-button'
import { Button } from '~/components/arc/button/button'
import { Input } from '~/components/arc/input/input'
import { PasswordStrength } from '~/components/arc/password-strength/password-strength'
import type { action, loader } from '~/routes/signup'

export function SignupModule() {
	const { email } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const submitting =
		navigation.state !== 'idle' && navigation.formAction === '/signup'
	const errorFor = (field: string) =>
		result?.field === field ? result.error : undefined

	return (
		<AuthLayout
			title="Create your workspace"
			description="Free for up to 3 people. No card required."
			switchLead="Already have an account?"
			switchLabel="Sign in"
			switchTo="/login"
		>
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
