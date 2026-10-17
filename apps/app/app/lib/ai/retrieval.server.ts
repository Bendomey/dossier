import { retrievalMinSimilarity } from './model/config.server'
import type { Passage } from './sources.server'
import { visibleCollections } from '~/api/collections/server'
import { db } from '~/lib/db.server'

const MAX_PASSAGES = 8
const MAX_PER_DOCUMENT = 3
const TOKEN_BUDGET = 6_000

export class RetrievalError extends Error {
	constructor(cause: unknown) {
		super('Retrieval failed', { cause })
		this.name = 'RetrievalError'
	}
}

/** Recomputed every turn from current membership; a chat's narrowed scope only ever shrinks it. */
export async function readableCollectionIds(session: Session, chatId: string) {
	const [visible, chosen] = await Promise.all([
		db().collection.findMany({
			where: visibleCollections(session),
			select: { id: true },
		}),
		db().chatCollection.findMany({
			where: { organizationId: session.organization.id, chatId },
			select: { collectionId: true },
		}),
	])
	const ids = visible.map((collection) => collection.id)
	if (!chosen.length) return { ids, narrowed: false }
	const allowed = new Set(chosen.map((row) => row.collectionId))
	return { ids: ids.filter((id) => allowed.has(id)), narrowed: true }
}

interface PassageRow {
	chunk_id: string
	document_id: string
	document_name: string
	version_id: string
	version_number: number
	content: string
	page_start: number | null
	page_end: number | null
	section_number: string | null
	section_title: string | null
	token_count: number
	similarity: number | null
	lexical: boolean
	score: number
}

/**
 * Exact vector search plus full-text search over the organization's live
 * chunks: active, readable documents, their current version, that version's
 * indexed job, embedded with the model queries use. Up to 30 candidates from
 * each search, fused as 1 / (60 + rank).
 */
export async function searchPassages(input: {
	organizationId: string
	collectionIds: string[]
	query: string
	embedding: number[]
	embeddingModel: string
}): Promise<Passage[]> {
	if (!input.collectionIds.length) return []
	const vector = `[${input.embedding.join(',')}]`

	let rows: PassageRow[]
	try {
		rows = await db().$queryRaw<PassageRow[]>`
			WITH eligible AS (
				SELECT c.id, c.document_id, c.document_version_id, c.content, c.page_number,
				       c.page_end, c.section_number, c.section_title, c.token_count,
				       c.embedding, c.search_vector, d.name AS document_name, v.version_number
				FROM document_chunks c
				JOIN documents d
				  ON d.organization_id = c.organization_id AND d.id = c.document_id
				JOIN document_versions v
				  ON v.organization_id = c.organization_id AND v.id = d.current_version_id
				JOIN indexing_jobs j
				  ON j.organization_id = c.organization_id AND j.id = v.indexed_job_id
				WHERE c.organization_id = ${input.organizationId}::uuid
				  AND d.status = 'ACTIVE'
				  AND d.deleted_at IS NULL
				  AND d.collection_id = ANY(${input.collectionIds}::uuid[])
				  AND c.document_version_id = v.id
				  AND c.indexing_job_id = v.indexed_job_id
				  AND j.embedding_model = ${input.embeddingModel}
				  AND c.embedding IS NOT NULL
			),
			vector_hits AS (
				SELECT id,
				       row_number() OVER (ORDER BY embedding <=> ${vector}::vector) AS rank,
				       1 - (embedding <=> ${vector}::vector) AS similarity
				FROM eligible
				ORDER BY embedding <=> ${vector}::vector
				LIMIT 30
			),
			lexical_hits AS (
				SELECT e.id,
				       row_number() OVER (ORDER BY ts_rank_cd(e.search_vector, q.query) DESC) AS rank
				FROM eligible e, websearch_to_tsquery('simple', ${input.query}) AS q(query)
				WHERE e.search_vector @@ q.query
				ORDER BY ts_rank_cd(e.search_vector, q.query) DESC
				LIMIT 30
			)
			SELECT e.id AS chunk_id, e.document_id, e.document_name,
			       e.document_version_id AS version_id, e.version_number, e.content,
			       e.page_number AS page_start, e.page_end, e.section_number, e.section_title,
			       e.token_count,
			       vh.similarity::float8 AS similarity,
			       (lh.id IS NOT NULL) AS lexical,
			       (coalesce(1.0 / (60 + vh.rank), 0)
			        + coalesce(1.0 / (60 + lh.rank), 0))::float8 AS score
			FROM eligible e
			LEFT JOIN vector_hits vh ON vh.id = e.id
			LEFT JOIN lexical_hits lh ON lh.id = e.id
			WHERE vh.id IS NOT NULL OR lh.id IS NOT NULL
			ORDER BY score DESC
			LIMIT 30
		`
	} catch (error) {
		throw new RetrievalError(error)
	}

	const minSimilarity = retrievalMinSimilarity()
	const perDocument = new Map<string, number>()
	const passages: Passage[] = []
	let tokens = 0
	for (const row of rows) {
		if (!row.lexical && (row.similarity ?? 0) < minSimilarity) continue
		const fromDocument = perDocument.get(row.document_id) ?? 0
		if (fromDocument >= MAX_PER_DOCUMENT) continue
		if (passages.length && tokens + row.token_count > TOKEN_BUDGET) continue
		perDocument.set(row.document_id, fromDocument + 1)
		tokens += row.token_count
		passages.push({
			chunkId: row.chunk_id,
			documentId: row.document_id,
			documentName: row.document_name,
			versionId: row.version_id,
			versionNumber: Number(row.version_number),
			content: row.content,
			pageStart: row.page_start,
			pageEnd: row.page_end,
			sectionNumber: row.section_number,
			sectionTitle: row.section_title,
			tokenCount: Number(row.token_count),
			score: Number(row.score),
		})
		if (passages.length === MAX_PASSAGES) break
	}
	return passages
}
