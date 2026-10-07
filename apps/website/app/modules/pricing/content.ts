import { type MessageKey } from '~/lib/i18n/messages'

export type BillingPeriod = 'monthly' | 'annual'

export const ANNUAL_DISCOUNT = 0.2

export interface Plan {
	name: string
	blurb: MessageKey
	monthlyPrice: number | null
	cta: MessageKey
	ctaHref: string
	lead: MessageKey
	items: MessageKey[]
	popular?: boolean
}

export const PLANS: Plan[] = [
	{
		name: 'Free',
		blurb: 'pricing.plans.freeBlurb',
		monthlyPrice: 0,
		cta: 'nav.startFree',
		ctaHref: '/#access',
		lead: 'pricing.plans.includes',
		items: [
			'pricing.plans.upTo3Users',
			'pricing.plans.50Documents',
			'pricing.plans.100Questions',
			'pricing.plans.5Reviews',
		],
	},
	{
		name: 'Team',
		blurb: 'pricing.plans.teamBlurb',
		monthlyPrice: 15,
		popular: true,
		cta: 'pricing.plans.startTrial',
		ctaHref: '/#access',
		lead: 'pricing.plans.everythingInFree',
		items: [
			'pricing.plans.upTo25Users',
			'pricing.plans.2000Documents',
			'pricing.plans.unlimitedQuestions',
			'pricing.plans.50Reviews',
			'pricing.plans.approvedTemplates',
		],
	},
	{
		name: 'Business',
		blurb: 'pricing.plans.businessBlurb',
		monthlyPrice: 35,
		cta: 'pricing.plans.startTrial',
		ctaHref: '/#access',
		lead: 'pricing.plans.everythingInTeam',
		items: [
			'pricing.plans.unlimitedUsers',
			'pricing.plans.10000Documents',
			'pricing.plans.unlimitedReviews',
			'pricing.plans.permissionGroups',
			'pricing.plans.auditSso',
		],
	},
	{
		name: 'Enterprise',
		blurb: 'pricing.plans.enterpriseBlurb',
		monthlyPrice: null,
		cta: 'pricing.plans.talkToUs',
		ctaHref: '/#contact',
		lead: 'pricing.plans.everythingInBusiness',
		items: [
			'pricing.plans.unlimitedDocuments',
			'pricing.plans.modelRouting',
			'pricing.plans.residency',
			'pricing.plans.sla',
			'pricing.plans.support',
		],
	},
]

/** A literal value, a translated value, or a number with a translated unit. */
export type Cell =
	| string
	| { key: MessageKey }
	| { value: string; unit: MessageKey }

const unlimited = { key: 'pricing.compare.unlimited' } as const
const yes = { key: 'pricing.compare.yes' } as const
const perMonth = (value: string) =>
	({ value, unit: 'pricing.compare.perMonth' }) as const

export const COMPARISON: Array<{ feature: MessageKey; cells: Cell[] }> = [
	{
		feature: 'pricing.compare.users',
		cells: ['3', '25', unlimited, unlimited],
	},
	{
		feature: 'pricing.compare.documents',
		cells: ['50', '2,000', '10,000', unlimited],
	},
	{
		feature: 'pricing.compare.qa',
		cells: [perMonth('100'), unlimited, unlimited, unlimited],
	},
	{
		feature: 'pricing.compare.review',
		cells: [perMonth('5'), perMonth('50'), unlimited, unlimited],
	},
	{
		feature: 'pricing.compare.drafting',
		cells: [{ key: 'pricing.compare.basic' }, yes, yes, yes],
	},
	{ feature: 'pricing.compare.comparison', cells: [yes, yes, yes, yes] },
	{ feature: 'pricing.compare.language', cells: [yes, yes, yes, yes] },
	{ feature: 'pricing.compare.permissions', cells: ['—', '—', yes, yes] },
	{ feature: 'pricing.compare.sso', cells: ['—', '—', yes, yes] },
	{ feature: 'pricing.compare.residency', cells: ['—', '—', '—', yes] },
]

export const FAQS: Array<{ question: MessageKey; answer: MessageKey }> = [
	{ question: 'pricing.faq.documentQ', answer: 'pricing.faq.documentA' },
	{ question: 'pricing.faq.trainingQ', answer: 'pricing.faq.trainingA' },
	{ question: 'pricing.faq.cediQ', answer: 'pricing.faq.cediA' },
	{ question: 'pricing.faq.limitQ', answer: 'pricing.faq.limitA' },
	{ question: 'pricing.faq.switchQ', answer: 'pricing.faq.switchA' },
]
