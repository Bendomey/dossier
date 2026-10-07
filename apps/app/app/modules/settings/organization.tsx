import { SettingRow } from './setting-row'
import { useGetOrganization, useUpdateOrganization } from '~/api/organization'
import { Alert } from '~/components/arc/alert/alert'
import { Skeleton } from '~/components/arc/skeleton/skeleton'
import { Switch } from '~/components/arc/switch/switch'
import { NativeSelect, TextInput } from '~/components/form-controls'

const TOGGLES: Array<{
	key: 'require_citations' | 'members_can_upload' | 'detect_document_language'
	label: string
	description: string
}> = [
	{
		key: 'require_citations',
		label: 'Require citations',
		description:
			'Answers without a source are flagged instead of shown as fact.',
	},
	{
		key: 'members_can_upload',
		label: 'Members can upload',
		description: 'Turn off to let only admins add documents.',
	},
	{
		key: 'detect_document_language',
		label: 'Detect document language',
		description:
			'Store a language for every upload so people can ask in any language.',
	},
]

export function OrganizationSettingsModule() {
	const { data: organization, isPending } = useGetOrganization()
	const update = useUpdateOrganization()

	if (isPending || !organization)
		return <Skeleton lines={6} label="Loading organization" />

	return (
		<div className="flex flex-col">
			<p aria-live="polite" className="text-muted h-5 self-end text-xs">
				{update.isPending
					? 'Saving…'
					: update.isSuccess
						? 'All changes saved'
						: ''}
			</p>
			{update.isError ? (
				<Alert tone="danger" title="Your change wasn’t saved">
					{update.error.message}
				</Alert>
			) : null}

			<SettingRow
				label="Organization name"
				description="Shown to your team and on exports."
			>
				{(labelId) => (
					<TextInput
						aria-labelledby={labelId}
						defaultValue={organization.name}
						onBlur={(event) => {
							const name = event.target.value.trim()
							if (name && name !== organization.name) update.mutate({ name })
						}}
					/>
				)}
			</SettingRow>
			<SettingRow
				label="Country"
				description="Used for legal context in answers."
			>
				{(labelId) => (
					<NativeSelect
						aria-labelledby={labelId}
						value={organization.country}
						onChange={(event) =>
							update.mutate({
								country: event.target.value as Organization['country'],
							})
						}
					>
						<option value="GH">Ghana</option>
						<option value="LR">Liberia</option>
					</NativeSelect>
				)}
			</SettingRow>
			<SettingRow
				label="AI response language"
				description="People can still ask in any language."
			>
				{(labelId) => (
					<NativeSelect
						aria-labelledby={labelId}
						value={organization.response_language}
						onChange={(event) =>
							update.mutate({
								response_language: event.target.value as ResponseLanguage,
							})
						}
					>
						<option value="MATCH">Match the question</option>
						<option value="EN">English</option>
						<option value="FR">Français</option>
						<option value="PT">Português</option>
					</NativeSelect>
				)}
			</SettingRow>
			{TOGGLES.map((toggle) => (
				<SettingRow
					key={toggle.key}
					label={toggle.label}
					description={toggle.description}
					inline
				>
					{(labelId) => (
						<Switch
							aria-labelledby={labelId}
							checked={organization[toggle.key]}
							onCheckedChange={(checked) =>
								update.mutate({ [toggle.key]: checked })
							}
						/>
					)}
				</SettingRow>
			))}
		</div>
	)
}
