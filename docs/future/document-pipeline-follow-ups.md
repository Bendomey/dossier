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
- **Larger files.** Raise the 25 MB / 300-page / 50-OCR-page MVP limits once
  benchmarks justify it (possibly a larger container instance); multipart
  uploads only beyond ~100 MB.
- **Per-organization OCR quotas.** Override `OCR_MONTHLY_PAGE_LIMIT` per
  organization (plans, billing).
- **Asynchronous job handoff.** Let the Worker hand jobs to the processor and
  return immediately, if measurements show jobs can't reliably finish inside
  one queue consumer invocation.
- **Faster OCR.** Pages are rendered and sent one at a time; if the benchmark
  shows 50 scanned pages plus embedding near the 12-minute deadline, send 2–3
  pages concurrently.
- **Release unused OCR reservations.** All uncached pages are reserved up
  front, so pages that end up never sent (Gemini failure, timeout, lost claim,
  render failure, oversized image) stay counted for the month.
- **CI deploys** for the indexing Worker and the Go processor (today: `yarn deploy` by hand).
- **Remove direct dispatch** (`INDEXING_DISPATCH=direct` and its retry loop in `api/indexing/server.ts`) if local development moves to the queue.

## Carry into Plan 2 (Go processor), from the Plan 1 reviews

- Always set `document_chunks.indexing_job_id` (its unique key doesn't guard NULLs); add NOT NULL once the processor is live. The processor always sets it (done in Plan 2); the NOT NULL constraint is still open.
- When a job finds its document removed or a newer job for the version, end it `FAILED` with `SUPERSEDED` (Remove only soft-deletes). (done in Plan 2)
- A Retry is a new job row: delete the failed job's chunks, or reuse them when resuming embedding. (done in Plan 2)
- Ensure `document_versions.indexed_job_id` points at a job of the same version (the FK doesn't enforce it). (done in Plan 2)
- Grants to revisit: `UPDATE` on `ai_runs` if runs are inserted RUNNING and updated later; `SELECT` for any `INSERT … RETURNING`; `indexing_worker` has no `SELECT` on `documents` (the `document.indexing_failed` audit needs a `target` name — use `document_versions.file_name` or grant `SELECT (name)`); worker can't set `error_message`.
- Read `file_key` verbatim; every environment uses the same bucket and real keys, so the processor's artifacts go under `org/{org}/versions/{id}/…` everywhere.
- Until it runs on Cloudflare, the processor is called directly by the app in development (`POST http://localhost:8080/jobs` with the queue message body).
- Before the first Supabase deploy of the `document_ingestion` migration, confirm the CI migrate user (`DIRECT_URL`) has CREATEROLE.

## Small polish left from Plan 1

- Overview counts: `latestJobStatuses` returns a row per live document (aggregate in SQL later); `total`/`ready` can include documents with no version.
- `cleanFileName` can split a surrogate pair when truncating.
- The disabled Upload button (no collections yet) has no explanation.
