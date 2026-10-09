# Document pipeline: follow-ups

Work deliberately left out of the first document ingestion and indexing
release (see `docs/superpowers/specs/2026-10-09-document-ingestion-indexing-design.md`).
Each item is meant to become its own spec.

## Retrieval and AI use

- **Retrieval service.** Query only chunks of the person's organization,
  collections they can read, the document's active version
  (`documents.current_version_id`) and that version's indexed job
  (`document_versions.indexed_job_id`), produced by the current embedding model.
- **Hybrid search.** Combine pgvector similarity with PostgreSQL full-text
  search, then rerank.
- **HNSW index.** Recreate `document_chunks_embedding_idx` outside Prisma once
  retrieval exists (see the `defer_embedding_index` migration).
- **Chat citations.** Cite the immutable document version and source location
  (page, section), never internal chunk IDs; yesterday's conversation must not
  silently cite today's version.
- **Temporary chat attachments.** Reuse the processing engine with their own
  visibility, retention and lifecycle, separate from the knowledge base.

## Access and versions

- **Per-document access.** Let a document override its collection's groups
  (a `document_groups` table), wired into the list, the drawer and retrieval.
- **Roll back to an older version.** Make a previous, already indexed version
  current again.
- **Duplicate-upload warnings.** Use the stored SHA-256 checksum to warn when
  the same file is uploaded twice in an organization. Never deduplicate across
  organizations.

## Storage and lifecycle

- **Delete files on removal.** Remove R2 originals and processing artifacts
  when a document is removed (and after any retention period).
- **Re-indexing.** Re-index versions when the pipeline or embedding model
  changes, using new `indexing_jobs` rows (`triggered_by = REINDEX`).
- **Multiple embedding models.** Move embeddings to a table keyed by chunk and
  model if we ever need two models live at once.

## Formats

- **Spreadsheets.** Sheets, rows, tables and cell references.
- **Images.** OCR or vision extraction for uploaded images.
- **Images inside DOCX.** OCR text that only exists as pictures.

## Operations

- **Upload quotas.** Per-file and per-organization limits beyond the monthly
  OCR page quota.
- **Metrics and dashboards.** Processing duration, retries, token and OCR
  usage, failure rates per stage.
- **Multipart uploads.** Only if files larger than 50 MB are allowed.
- **CI deploys** for the indexing Worker and the Go processor.
