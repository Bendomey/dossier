import { useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import { SettingRow } from './setting-row'
import { Alert } from '~/components/arc/alert/alert'
import { Switch } from '~/components/arc/switch/switch'
import { NativeSelect, TextInput } from '~/components/form-controls'
import { useSession } from '~/providers/session-provider'

type Field = keyof Omit<OrganizationSettings, 'id'>
type ActionResult = { ok: boolean; error: string | null }

const FETCHER_PREFIX = 'organization-setting:'

type ToggleField =
	| 'require_citations'
	| 'members_can_upload'
	| 'detect_document_language'

const TOGGLES: Array<{ key: ToggleField; label: string; description: string }> =
	[
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

/** One fetcher per field, so changing two settings quickly never cancels the first save. */
function useFieldSaver(field: Field) {
	const fetcher = useFetcher<ActionResult>({ key: `${FETCHER_PREFIX}${field}` })
	const save = (value: string | boolean) =>
		fetcher.submit({ [field]: String(value) }, { method: 'post' })
	return { save, fetcher }
}

function SaveStatus({
	fetchers,
}: {
	fetchers: Array<ReturnType<typeof useFetcher<ActionResult>>>
}) {
	const saving = fetchers.some((fetcher) => fetcher.state !== 'idle')
	const error = fetchers.map((fetcher) => fetcher.data?.error).find(Boolean)
	const saved = fetchers.some((fetcher) => fetcher.data?.ok)

	return (
		<>
			<p aria-live="polite" className="text-muted h-5 self-end text-xs">
				{saving ? 'Saving…' : saved && !error ? 'All changes saved' : ''}
			</p>
			{error ? (
				<Alert tone="danger" title="Your change wasn’t saved">
					{error}
				</Alert>
			) : null}
		</>
	)
}

export function OrganizationSettingsModule() {
	const { settings } = useLoaderData() as { settings: OrganizationSettings }
	const { can } = useSession()
	const editable = can('organization.update')
	const [values, setValues] = useState(settings)

	const savers = {
		name: useFieldSaver('name'),
		country: useFieldSaver('country'),
		response_language: useFieldSaver('response_language'),
		require_citations: useFieldSaver('require_citations'),
		members_can_upload: useFieldSaver('members_can_upload'),
		detect_document_language: useFieldSaver('detect_document_language'),
	}

	function change<K extends Field>(field: K, value: OrganizationSettings[K]) {
		setValues((current) => ({ ...current, [field]: value }))
		void savers[field].save(value)
	}

	return (
		<div className="flex flex-col">
			<SaveStatus
				fetchers={Object.values(savers).map((saver) => saver.fetcher)}
			/>
			{editable ? null : (
				<Alert tone="info" title="Only the owner can change these settings">
					Ask the owner of {settings.name} if something needs to change.
				</Alert>
			)}

			<SettingRow
				label="Organization name"
				description="Shown to your team and on exports."
			>
				{(labelId) => (
					<TextInput
						aria-labelledby={labelId}
						defaultValue={values.name}
						disabled={!editable}
						maxLength={120}
						onBlur={(event) => {
							const name = event.target.value.trim()
							if (name && name !== values.name) change('name', name)
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
						value={values.country}
						disabled={!editable}
						onChange={(event) =>
							change(
								'country',
								event.target.value as OrganizationSettings['country'],
							)
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
						value={values.response_language}
						disabled={!editable}
						onChange={(event) =>
							change(
								'response_language',
								event.target.value as ResponseLanguage,
							)
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
							checked={values[toggle.key]}
							disabled={!editable}
							onCheckedChange={(checked) => change(toggle.key, checked)}
						/>
					)}
				</SettingRow>
			))}
		</div>
	)
}
