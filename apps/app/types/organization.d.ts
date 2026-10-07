type ResponseLanguage = 'MATCH' | 'EN' | 'FR' | 'PT'

interface Organization {
	id: string
	name: string
	country: 'GH' | 'LR'
	response_language: ResponseLanguage
	require_citations: boolean
	members_can_upload: boolean
	detect_document_language: boolean
	plan: { name: string; billing: 'MONTHLY' | 'YEARLY'; seats: number }
}

interface UpdateOrganizationInput {
	name?: string
	country?: Organization['country']
	response_language?: ResponseLanguage
	require_citations?: boolean
	members_can_upload?: boolean
	detect_document_language?: boolean
}
