export function groupNames(groupIds: string[], groups?: Group[]) {
	if (!groups) return ''
	const names = groupIds
		.map((groupId) => groups.find((group) => group.id === groupId)?.name)
		.filter(Boolean)
	return names.length ? names.join(', ') : 'Only admins'
}

export function effectiveGroupIds(
	document: DossierDocument,
	collections: Collection[] = [],
) {
	return (
		document.group_ids ??
		collections.find((collection) => collection.id === document.collection_id)
			?.group_ids ??
		[]
	)
}

export function documentStatus(document: DossierDocument) {
	switch (document.status) {
		case 'READY':
			return {
				label: document.is_template ? 'Approved template' : 'Ready for AI',
				tone: 'text-success',
			}
		case 'PROCESSING':
			return { label: `Indexing ${document.progress}%`, tone: 'text-accent' }
		case 'QUEUED':
			return {
				label: document.retrying ? 'Retrying…' : 'Queued',
				tone: 'text-secondary',
			}
		case 'FAILED':
			return { label: 'Failed', tone: 'text-danger' }
	}
}

const STAGE_LABELS: Record<IndexingStage, string> = {
	EXTRACTING: 'Reading pages',
	CHUNKING: 'Splitting into clauses',
	EMBEDDING: 'Indexing',
	ACTIVATING: 'Finishing',
}

export const stageLabel = (stage: IndexingStage | null) =>
	stage ? STAGE_LABELS[stage] : null

export function pendingVersionLabel(pending: PendingVersion) {
	switch (pending.status) {
		case 'FAILED':
			return 'failed'
		case 'QUEUED':
			return 'queued'
		case 'PROCESSING':
			return `processing ${pending.progress}%`
	}
}
