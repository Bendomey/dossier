import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { Button } from '~/components/arc/button/button'
import { Input } from '~/components/arc/input/input'
import { AuthLayout } from '~/modules/auth/auth-layout'
import type { action, loader } from '~/routes/onboarding'

export function OnboardingModule() {
	const { email } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const submitting =
		navigation.state !== 'idle' && navigation.formAction === '/onboarding'

	return (
		<AuthLayout
			title="Set up your workspace"
			description={`Signed in as ${email}. Name the company Dossier will answer for.`}
			switchLead="Wrong account?"
			switchLabel="Sign out"
			switchTo="/logout"
			switchMethod="post"
		>
			<Form method="post" className="flex flex-col gap-3.5" noValidate>
				<Input
					label="Company"
					name="company"
					autoComplete="organization"
					placeholder="Asante & Co."
					autoFocus
					error={result?.error}
				/>
				<Button
					type="submit"
					size="lg"
					loading={submitting}
					className="mt-1 w-full"
				>
					Create workspace
				</Button>
			</Form>
		</AuthLayout>
	)
}
