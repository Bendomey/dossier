type DocumentFileType = 'PDF' | 'DOCX' | 'TXT' | 'MD'
type DocumentLanguage = 'EN' | 'FR' | 'PT'
type DocumentStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED'
type IndexingStage = 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'ACTIVATING'
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
	stage: IndexingStage | null
	/** 0-100 while QUEUED or PROCESSING. */
	progress: number
	/** Plain reason when FAILED. */
	error: string | null
	/** QUEUED again after a transient failure. */
	retrying: boolean
	/** FAILED and the viewer may retry it. */
	can_retry: boolean
	/** The newest version; Retry targets it. */
	latest_version_id: string
	/** A newer version than the live one, still being indexed or failed. */
	pending_version: PendingVersion | null
	is_template: boolean
	pages: number
	uploaded_by: string
	answer_count: number
	updated_at: string
	/** null means the document follows its collection's access. */
	group_ids: string[] | null
}

interface PendingVersion {
	version_number: number
	status: Exclude<DocumentStatus, 'READY'>
	progress: number
	error: string | null
}

interface DocumentVersionDetail {
	id: string
	version_number: number
	file_name: string
	status: DocumentStatus
	progress: number
	error: string | null
	can_retry: boolean
	is_current: boolean
	page_count: number | null
	uploaded_by: string
	created_at: string
}

/** The document drawer in a real workspace. */
interface DocumentDetail {
	document: DossierDocument
	collection_name: string
	versions: DocumentVersionDetail[]
	can_upload_version: boolean
	can_remove: boolean
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
	failed: number
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
}

/** Knowledge in a real workspace: what the signed-in person can see. */
interface KnowledgeOverview {
	collections: Collection[]
	documents: DossierDocument[]
	stats: KnowledgeStats
	groups: Group[]
	uploads_enabled: boolean
	can_upload: boolean
}
