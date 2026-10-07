import { type MessageKey } from '~/lib/i18n/messages'

interface Copy {
	title: MessageKey
	body: MessageKey
}

export const DEMO_TABS = [
	{
		value: 'ask',
		label: 'home.demo.ask',
		note: 'home.demo.askNote',
		query: 'screen=workspace&play=ask',
	},
	{
		value: 'review',
		label: 'home.demo.review',
		note: 'home.demo.reviewNote',
		query: 'screen=workspace&play=review',
	},
	{
		value: 'draft',
		label: 'home.demo.draft',
		note: 'home.demo.draftNote',
		query: 'screen=workspace&play=draft',
	},
	{
		value: 'compare',
		label: 'home.demo.compare',
		note: 'home.demo.compareNote',
		query: 'screen=workspace&play=compare',
	},
	{
		value: 'knowledge',
		label: 'home.demo.knowledge',
		note: 'home.demo.knowledgeNote',
		query: 'screen=knowledge',
	},
] as const satisfies ReadonlyArray<{
	value: string
	label: MessageKey
	note: MessageKey
	query: string
}>

export type DemoTab = (typeof DEMO_TABS)[number]['value']

export const FEATURES: Array<Copy & { tag: MessageKey; tab: DemoTab }> = [
	{
		tag: 'home.features.askTag',
		title: 'home.features.askTitle',
		body: 'home.features.askBody',
		tab: 'ask',
	},
	{
		tag: 'home.features.reviewTag',
		title: 'home.features.reviewTitle',
		body: 'home.features.reviewBody',
		tab: 'review',
	},
	{
		tag: 'home.features.draftTag',
		title: 'home.features.draftTitle',
		body: 'home.features.draftBody',
		tab: 'draft',
	},
	{
		tag: 'home.features.compareTag',
		title: 'home.features.compareTitle',
		body: 'home.features.compareBody',
		tab: 'compare',
	},
]

export const EXTRAS: Copy[] = [
	{
		title: 'home.features.proofreadingTitle',
		body: 'home.features.proofreadingBody',
	},
	{ title: 'home.features.languageTitle', body: 'home.features.languageBody' },
	{ title: 'home.features.exportsTitle', body: 'home.features.exportsBody' },
]

export const STEPS: Copy[] = [
	{ title: 'home.steps.uploadTitle', body: 'home.steps.uploadBody' },
	{ title: 'home.steps.indexTitle', body: 'home.steps.indexBody' },
	{ title: 'home.steps.workTitle', body: 'home.steps.workBody' },
]

export const SECURITY_POINTS: Copy[] = [
	{
		title: 'home.security.permissionsTitle',
		body: 'home.security.permissionsBody',
	},
	{ title: 'home.security.citedTitle', body: 'home.security.citedBody' },
	{ title: 'home.security.dataTitle', body: 'home.security.dataBody' },
]
