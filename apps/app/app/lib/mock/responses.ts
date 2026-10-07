interface ScriptedReply {
	status: string
	text: string
	sources?: ChatSource[]
	findings?: ReviewFinding[]
	changes?: DocumentChange[]
	draft?: DraftAttachment
}

const REPLIES: Record<
	'ask' | 'leave' | 'draft' | 'review' | 'compare',
	ScriptedReply
> = {
	ask: {
		status: 'Searching 121 documents',
		text: 'Only for a serious breach. The Employee Handbook allows summary dismissal for gross misconduct, which includes disclosing confidential information [1].\n\nThe Standard Employment Contract still requires written notice of the breach and a disciplinary hearing before termination [2]. Skipping the hearing could expose the company to an unfair dismissal claim.',
		sources: [
			{ key: '1', title: 'Employee Handbook 2026, §7.3' },
			{ key: '2', title: 'Standard Employment Contract, 14.2' },
		],
	},
	leave: {
		status: 'Searching 121 documents',
		text: 'New hires get 20 working days of annual leave, prorated in their first calendar year [1]. Unused days can carry over up to 5 days, with manager approval [2].',
		sources: [
			{ key: '1', title: 'Employee Handbook 2026, §4.1' },
			{ key: '2', title: 'Leave and Benefits Policy, 3.2' },
		],
	},
	draft: {
		status: 'Assembling from Employment Agreement v3',
		text: 'Your draft is ready. I used Employment Agreement v3 and filled in the role, start date and salary band. The confidentiality, notice and termination clauses are your approved wording, unchanged.\n\nTwo fields need your input: probation length and reporting manager.',
		draft: {
			title: 'Employment Agreement, Kwame Mensah',
			meta: 'Based on Employment Agreement v3 · 9 pages · English',
		},
		sources: [{ key: 'T', title: 'Employment Agreement v3' }],
	},
	review: {
		status: 'Reading 18 clauses against your standards',
		text: 'I reviewed the Acme Supply Agreement against your Vendor Agreement Template and Finance Policy. There are 3 findings, one of them high risk.',
		findings: [
			{
				severity: 'HIGH',
				clause: 'Clause 8, Termination',
				text: 'The supplier can terminate with 7 days’ notice. Your standard requires 30 days.',
				source: 'Vendor Agreement Template, §12',
			},
			{
				severity: 'MEDIUM',
				clause: 'Clause 5, Payment terms',
				text: 'Payment is due within 60 days. Your Finance Policy caps terms at 30 days.',
				source: 'Finance Policy, §2.4',
			},
			{
				severity: 'LOW',
				clause: 'Clause 14, Definitions',
				text: '“Supplier” and “Vendor” are used for the same party. Pick one term.',
				source: 'Proofreading',
			},
		],
	},
	compare: {
		status: 'Comparing v2 and v3',
		text: 'There are 4 changes between v2 and v3 of the Partnership Agreement. Two of them change obligations and conflict with your records.',
		changes: [
			{
				removed: 'Profits are shared 50/50 between the partners.',
				added: 'Profits are shared 60/40 in favour of Partner A.',
				note: 'Conflicts with Board Resolution 2025, item 3',
			},
			{
				removed: 'Either party has 30 days to cure a breach.',
				added: 'Either party has 14 days to cure a breach.',
				note: 'Shorter than your standard of 30 days',
			},
		],
	},
}

/** Picks a canned reply the way the real assistant would route the request. */
export function pickReply(
	prompt: string,
	mode: ChatMode | null,
): ScriptedReply {
	const kind =
		mode ??
		(/draft|write|create/i.test(prompt)
			? 'DRAFT'
			: /review|risk|proofread/i.test(prompt)
				? 'REVIEW'
				: /compare|changed|difference/i.test(prompt)
					? 'COMPARE'
					: 'ASK')

	if (kind === 'ASK')
		return /leave|holiday/i.test(prompt) ? REPLIES.leave : REPLIES.ask
	if (kind === 'DRAFT') return REPLIES.draft
	if (kind === 'REVIEW') return REPLIES.review
	return REPLIES.compare
}
