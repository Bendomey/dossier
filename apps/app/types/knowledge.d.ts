type DocumentFileType = 'PDF' | 'DOCX'
type DocumentLanguage = 'EN' | 'FR' | 'PT'
type DocumentStatus = 'PROCESSING' | 'READY'
type CollectionIconName = 'scale' | 'people' | 'building' | 'briefcase'

interface Collection {
	id: string
	name: string
	icon: CollectionIconName
	description?: string | null
	document_count: number
	/** Groups that can see every document in the collection, unless a document overrides it. */
	group_ids: string[]
}

interface DossierDocument {
	id: string
	name: string
	file_type: DocumentFileType
	collection_id: string
	language: DocumentLanguage
	status: DocumentStatus
	/** 0-100 while status is PROCESSING. */
	progress: number
	is_template: boolean
	pages: number
	uploaded_by: string
	answer_count: number
	updated_at: string
	/** null means the document follows its collection's access. */
	group_ids: string[] | null
}

interface DocumentVersion {
	id: string
	label: string
	note: string
	created_at: string
	is_current: boolean
}

interface KnowledgeStats {
	total: number
	ready: number
	processing: number
	templates: number
}

interface FetchDocumentsFilter {
	collection_id?: string
	templates_only?: boolean
	query?: string
}

interface UploadDocumentInput {
	file_name: string
	size: number
	collection_id: string
	/** null keeps the collection's access. */
	group_ids: string[] | null
}

/** Knowledge in a real workspace: what the signed-in person can see. */
interface KnowledgeOverview {
	collections: Collection[]
	documents: DossierDocument[]
	stats: KnowledgeStats
	groups: Group[]
}
