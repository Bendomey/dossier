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
	return document.status === 'READY'
		? {
				label: document.is_template ? 'Approved template' : 'Ready for AI',
				tone: 'text-success',
			}
		: { label: `Indexing ${document.progress}%`, tone: 'text-accent' }
}
