/**
 * Every user-facing string on the site, in English. Other languages are
 * produced from this dictionary by `translate.server.ts`, so add new copy here
 * rather than inline in components.
 */
export const messages = {
	'nav.product': 'Product',
	'nav.security': 'Security',
	'nav.pricing': 'Pricing',
	'nav.contact': 'Contact',
	'nav.signIn': 'Sign in',
	'nav.startFree': 'Start free',
	'nav.openMenu': 'Open menu',
	'nav.closeMenu': 'Close menu',
	'nav.language': 'Language',

	'footer.privacy': 'Privacy',
	'footer.terms': 'Terms',
	'footer.security': 'Security',
	'footer.contact': 'Contact',
	'footer.company': 'Dossier Technologies Ltd. · Accra, Ghana',

	'notFound.title': 'Page not found',
	'notFound.message': 'Sorry, we couldn’t find the page you’re looking for.',
	'notFound.cta': 'Go back home',

	'home.meta.title': 'Dossier · Your company’s documents, now answering back',
	'home.meta.description':
		'Cited answers, contract review and drafting, grounded in your own company documents.',
	'home.hero.badge': 'Early access',
	'home.hero.announcement': 'Now onboarding companies in Ghana and Liberia',
	'home.hero.title': 'Your company’s documents, finally answering back.',
	'home.hero.body':
		'Dossier reads your contracts, policies and templates, then answers questions, reviews agreements and drafts new ones from what your company has already approved. Every answer is cited.',
	'home.hero.secondaryCta': 'See how it works',

	'home.demo.label': 'Product demo',
	'home.demo.ask': 'Ask',
	'home.demo.review': 'Review',
	'home.demo.draft': 'Draft',
	'home.demo.compare': 'Compare',
	'home.demo.knowledge': 'Knowledge',
	'home.demo.askNote':
		'Live product. Answers cite the exact section they came from.',
	'home.demo.reviewNote':
		'Live product. Findings are checked against your own templates and policies.',
	'home.demo.draftNote':
		'Live product. Drafts are assembled from your approved templates.',
	'home.demo.compareNote':
		'Live product. Every change is checked against your records.',
	'home.demo.knowledgeNote':
		'Live product. Click a document to see who can access it.',

	'home.features.title': 'Four jobs, one source of truth.',
	'home.features.body':
		'Dossier doesn’t make up answers. It looks up your documents first and then reasons over the relevant clauses, so its output matches how your company already works.',
	'home.features.try': 'Try it in the product',
	'home.features.askTag': 'Ask',
	'home.features.askTitle': 'Company Q&A',
	'home.features.askBody':
		'Ask the way you’d ask a colleague. Answers respect each user’s permissions and point to the exact section.',
	'home.features.reviewTag': 'Review',
	'home.features.reviewTitle': 'Contract review',
	'home.features.reviewBody':
		'Incoming agreements are checked clause by clause against your templates and policies. You get specific findings instead of a generic summary.',
	'home.features.draftTag': 'Draft',
	'home.features.draftTitle': 'Drafting from approved clauses',
	'home.features.draftBody':
		'New documents are assembled from your templates, not invented from scratch. Then you edit and export.',
	'home.features.compareTag': 'Compare',
	'home.features.compareTitle': 'Version comparison',
	'home.features.compareBody':
		'See what changed between versions and which of your policies each change affects.',
	'home.features.also': 'Also',
	'home.features.proofreadingTitle': 'Proofreading',
	'home.features.proofreadingBody':
		'Typos, inconsistent defined terms and broken cross-references.',
	'home.features.languageTitle': 'Works in your language',
	'home.features.languageBody':
		'Ask and draft in the language you prefer. Citations still point to the original clause.',
	'home.features.exportsTitle': 'Plain exports',
	'home.features.exportsBody': 'Download any draft or review as DOCX or PDF.',

	'home.steps.title': 'Up and running in an afternoon.',
	'home.steps.uploadTitle': 'Upload your documents',
	'home.steps.uploadBody':
		'PDF, DOCX and scans. Constitutions, handbooks, templates, signed agreements.',
	'home.steps.indexTitle': 'Dossier indexes them by clause',
	'home.steps.indexBody':
		'Each document is split into its sections and clauses, with your access rules applied, so answers point to the exact passage.',
	'home.steps.workTitle': 'Ask, review, draft',
	'home.steps.workBody':
		'Your whole team works from the same approved source, in whichever language they prefer.',

	'home.security.label': 'Security',
	'home.security.title': 'Built for documents that matter.',
	'home.security.permissionsTitle': 'Permission-aware',
	'home.security.permissionsBody':
		'People only get answers from the documents they’re allowed to open.',
	'home.security.citedTitle': 'Cited, every time',
	'home.security.citedBody':
		'Each claim links to its source clause. If the documents don’t cover something, Dossier tells you.',
	'home.security.dataTitle': 'Your data stays yours',
	'home.security.dataBody':
		'Documents are isolated per organization and never used to train models.',

	'home.access.title': 'Bring your documents. We’ll show you the answers.',
	'home.access.body':
		'We’re onboarding a small group of companies this quarter.',
	'home.access.emailLabel': 'Work email',
	'home.access.thanks': 'Thanks. We’ll be in touch at',
	'home.access.invalidEmail': 'Enter a valid work email',
	'home.access.talkFirst': 'Prefer to talk first?',
	'home.access.builtIn': 'Built in Accra.',

	'pricing.meta.title': 'Pricing | Dossier',
	'pricing.meta.description':
		'Start free. Pay when your team grows. Every plan includes cited answers, contract review and drafting.',
	'pricing.hero.title': 'Start free. Pay when your team grows.',
	'pricing.hero.body':
		'Every plan includes cited answers, contract review and drafting. Paid plans add more people, more documents and more control.',
	'pricing.billing.label': 'Billing period',
	'pricing.billing.monthly': 'Monthly',
	'pricing.billing.annual': 'Annual',
	'pricing.plans.popular': 'Most popular',
	'pricing.plans.custom': 'Custom',
	'pricing.plans.forever': 'forever',
	'pricing.plans.perUserMonthly': 'per user / mo',
	'pricing.plans.perUserYearly': 'per user / mo, billed yearly',
	'pricing.plans.startTrial': 'Start 14-day trial',
	'pricing.plans.talkToUs': 'Talk to us',
	'pricing.plans.includes': 'Includes',
	'pricing.plans.everythingInFree': 'Everything in Free, plus',
	'pricing.plans.everythingInTeam': 'Everything in Team, plus',
	'pricing.plans.everythingInBusiness': 'Everything in Business, plus',
	'pricing.plans.freeBlurb': 'For trying Dossier with a small team.',
	'pricing.plans.teamBlurb': 'For growing teams working from shared documents.',
	'pricing.plans.businessBlurb':
		'For legal, HR and ops teams that need control.',
	'pricing.plans.enterpriseBlurb':
		'For large organizations with custom requirements.',
	'pricing.plans.upTo3Users': 'Up to 3 users',
	'pricing.plans.50Documents': '50 documents',
	'pricing.plans.100Questions': '100 questions a month',
	'pricing.plans.5Reviews': '5 contract reviews a month',
	'pricing.plans.upTo25Users': 'Up to 25 users',
	'pricing.plans.2000Documents': '2,000 documents',
	'pricing.plans.unlimitedQuestions': 'Unlimited questions',
	'pricing.plans.50Reviews': '50 contract reviews a month',
	'pricing.plans.approvedTemplates': 'Approved templates for drafting',
	'pricing.plans.unlimitedUsers': 'Unlimited users',
	'pricing.plans.10000Documents': '10,000 documents',
	'pricing.plans.unlimitedReviews': 'Unlimited contract reviews',
	'pricing.plans.permissionGroups': 'Permission groups by team',
	'pricing.plans.auditSso': 'Audit log and SSO',
	'pricing.plans.unlimitedDocuments': 'Unlimited documents',
	'pricing.plans.modelRouting': 'Custom model routing',
	'pricing.plans.residency': 'Data residency options',
	'pricing.plans.sla': 'Uptime SLA and onboarding',
	'pricing.plans.support': 'Dedicated support',
	'pricing.plans.note':
		'Prices in USD, excluding taxes. Local-currency billing in Ghana cedis is coming soon.',

	'pricing.compare.title': 'Compare plans',
	'pricing.compare.feature': 'Feature',
	'pricing.compare.users': 'Users',
	'pricing.compare.documents': 'Documents',
	'pricing.compare.qa': 'Company Q&A with citations',
	'pricing.compare.review': 'Contract review',
	'pricing.compare.drafting': 'Drafting from templates',
	'pricing.compare.comparison': 'Comparison & proofreading',
	'pricing.compare.language': 'Any-language Q&A',
	'pricing.compare.permissions': 'Permission groups',
	'pricing.compare.sso': 'SSO & audit log',
	'pricing.compare.residency': 'Data residency',
	'pricing.compare.unlimited': 'Unlimited',
	'pricing.compare.yes': 'Yes',
	'pricing.compare.basic': 'Basic',
	'pricing.compare.perMonth': '/ mo',

	'pricing.faq.title': 'Questions',
	'pricing.faq.documentQ': 'What counts as a document?',
	'pricing.faq.documentA':
		'Any uploaded file, such as a PDF, DOCX or scan. A 40-page contract counts as one document.',
	'pricing.faq.trainingQ': 'Do you train AI models on our documents?',
	'pricing.faq.trainingA':
		'No. Your documents are isolated to your organization and used only to answer your team’s requests.',
	'pricing.faq.cediQ': 'Can we pay in Ghana cedis?',
	'pricing.faq.cediA':
		'Billing is in USD for now. Cedi billing and mobile money are on the roadmap.',
	'pricing.faq.limitQ': 'What happens if we hit a limit?',
	'pricing.faq.limitA':
		'Nothing gets deleted. You’ll see a prompt to upgrade, and your existing documents stay searchable.',
	'pricing.faq.switchQ': 'Can we switch plans later?',
	'pricing.faq.switchA':
		'Yes. You can upgrade or downgrade at any time, and we prorate the difference.',

	'pricing.cta.title': 'Try it on your own documents.',
} as const

export type Messages = Record<keyof typeof messages, string>
export type MessageKey = keyof typeof messages
