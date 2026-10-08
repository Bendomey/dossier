import { Form, useActionData, useLoaderData, useNavigation } from 'react-router'
import { Button } from '~/components/arc/button/button'
import { Input } from '~/components/arc/input/input'
import { AuthLayout } from '~/modules/auth/auth-layout'
import type { action, loader } from '~/routes/onboarding'

export function OnboardingModule() {
	const { email, additional } = useLoaderData<typeof loader>()
	const result = useActionData<typeof action>()
	const navigation = useNavigation()
	const submitting =
		navigation.state !== 'idle' &&
		navigation.formAction?.startsWith('/onboarding')

	return (
		<AuthLayout
			title={additional ? 'Create another workspace' : 'Set up your workspace'}
			description={`Signed in as ${email}. Name the company Dossier will answer for.`}
			{...(additional
				? {
						switchLead: 'Changed your mind?',
						switchLabel: 'Back to your workspaces',
						switchTo: '/workspaces',
					}
				: {
						switchLead: 'Wrong account?',
						switchLabel: 'Sign out',
						switchTo: '/logout',
						switchMethod: 'post' as const,
					})}
		>
			<Form
				method="post"
				action={additional ? '/onboarding?new=1' : '/onboarding'}
				className="flex flex-col gap-3.5"
				noValidate
			>
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
