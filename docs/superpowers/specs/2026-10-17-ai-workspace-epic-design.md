# AI workspace epic: design

Status: approved in brainstorming, 2026-10-17. Each sub-project below gets
its own spec, plan and implementation cycle; this document fixes what they
share.

## Goal

Dossier is a company-document intelligence and workflow product, not a
chatbot. The AI workspace offers four capabilities over a company's indexed
knowledge, in one conversation:

1. **Company Q&A.** Ask the way you'd ask a colleague. Answers respect each
   person's permissions and point to the exact section.
2. **Contract review.** An incoming agreement is checked clause by clause
   against the company's approved templates and policies, producing specific
   findings rather than a summary.
3. **Drafting from approved clauses.** New documents are assembled from
   approved templates, not invented; the person edits and exports them.
4. **Version comparison.** What changed between two versions, and which
   company policies each change affects.

The UI already has the four modes (`apps/app/app/modules/workspace/modes.ts`:
ASK, REVIEW, DRAFT, COMPARE) and a stream-event contract (`ChatStreamEvent`),
running on `~/lib/mock/db`. The data model started in the `AI workspace` and
`Document workspace` sections of `apps/app/prisma/schema.prisma`.

## Decisions

| Question | Decision |
|---|---|
| Where the reviewed or compared document comes from | Either a knowledge document version or a file attached to the chat |
| What "policies" and "approved clauses" are | Derived from what is uploaded: policies are knowledge documents with `document_type = POLICY`; approved clauses are the sections of approved templates (`document_templates.is_approved`), taken from the template's active indexed version. No curated clause library in this epic |
| Where long operations run | Durable jobs in the app server, detached from the HTTP request, with progress persisted in Postgres and streamed over SSE |
| What a draft is | A persistent artifact (`generated_documents` with revisions): a structured block tree rendered as markdown, edited in place, exported to DOCX |
| Orchestration | One orchestrator with one handler per operation. No agent loop: application code, not the model, decides which workflow runs and which sources it may see |
| Provider | Gemini, behind a provider-neutral adapter. Embeddings stay `gemini-embedding-001` at 1536 dimensions; generation models are chosen per operation by configuration |
| Where the code lives | The React Router app server (`apps/app`). The Go processor stays responsible for indexing only |

## Sub-projects and order

| # | Sub-project | Delivers | Introduces (reused later) |
|---|---|---|---|
| 1 | Foundation + Ask | Real chats on Prisma replacing the mock; Q&A with validated citations | Orchestrator, operation resolver, Gemini adapter, hybrid retrieval, SourceSet validation, SSE endpoints, `ai_runs` logging, audit entries |
| 2 | Chat attachments | Attach a file to a conversation; indexed by the existing pipeline, visible only in that chat, promotable to knowledge | `documents.scope`, attachment-aware retrieval, retention |
| 3 | Contract review | Clause-by-clause review of a knowledge document or attachment against approved templates and policies | Durable job runner (`ai_jobs`), clause segmentation, pinned evidence, "Use as approved template" on Knowledge |
| 4 | Version comparison | Two versions (or document vs attachment, or document vs template) → aligned clause changes, each with the policies it affects | Clause alignment, change classification |
| 5 | Drafting | Template + details → editable draft panel, revision history, DOCX export | Draft block tree, structured placeholders, provenance, editor, DOCX renderer |

1 comes first because its retrieval, adapter, validation and streaming are
everyone's foundation. 2 precedes 3 and 4 because both need attachments. 4
follows 3 to reuse the job runner and clause segmentation. 5 is last: the
largest UI, and it needs approved templates, which 3 makes possible.

**Not in this epic:** shared chats (`chat_members` stays unused), a curated
clause playbook (fallback positions, red lines), PDF export, agent-style tool
loops, per-document access overrides (tracked in
`docs/future/document-pipeline-follow-ups.md`), a per-organization AI budget.

## Operation outputs

| Operation | Output |
|---|---|
| ASK | Streamed answer whose citations reference validated sources |
| REVIEW | Findings: severity, the subject clause, explanation, evidence from templates and policies |
| COMPARE | Changes between two pinned versions: type, significance, both sides' text, affected policies |
| DRAFT | A draft artifact revision: block tree with approved-clause and generated blocks, unresolved placeholders, source references |
| intent detection | `{ operation, confidence, clarifyingQuestion? }` |

Every output has a schema, validated before it is persisted or shown.

## Operation resolution

- A mode chosen in the composer is the operation, subject to its permission.
  No intent call is made.
- With no mode, one call to the intent model returns an operation and a
  confidence. Below the confidence threshold, or when the operation needs an
  input the message doesn't identify (which document to review), the reply
  is a short clarifying question instead of a guess.
- Mixed requests stay deterministic: "review this and draft a fixed version"
  runs the review, and its reply offers "Start a corrected draft from these
  findings" (available once sub-project 5 ships).

## Shared architecture

### Module layout (`apps/app`)

```
app/api/chats/
  index.ts                 hooks (useGetChats, useCreateChat, useSendMessage, useReplyStream)
  client.ts                fetchers for the real endpoints
  server.ts                chats, messages, citations persistence (Prisma)
app/lib/ai/
  orchestrator.server.ts   authorize → resolve operation → run handler → persist → emit
  intent.server.ts         mode = null → operation, confidence, clarifying question
  operations/
    ask.server.ts          (1)
    review.server.ts       (3)
    compare.server.ts      (4)
    draft.server.ts        (5)
  model/
    types.ts               ModelAdapter, ModelRequest, ModelEvent, Usage
    gemini.server.ts       streaming, JSON-schema output, query embeddings
    config.server.ts       operation → { provider, model }, env-overridable
  retrieval.server.ts      readable scope + hybrid search → Passage[]
  sources.server.ts        SourceSet
  runs.server.ts           ai_runs start/finish wrapper
  replies.server.ts        in-process emitter, DB flusher, stall sweep
routes/
  _auth.api.chats._index.ts             GET list, POST create (with the first message)
  _auth.api.chats.$chatId._index.ts     GET one chat with messages and citations
  _auth.api.chats.$chatId.messages.ts   POST send (idempotent) → JSON
  _auth.api.chats.$chatId.stream.ts     GET follow a reply → SSE
  _auth.api.chats.$chatId.cancel.ts     POST cancel
```

### Handler interface

```ts
interface OperationHandler<Output> {
  operation: ChatOperation
  permission: PermissionKey
  run(ctx: OperationContext, emit: Emit): Promise<Output>
  persist(tx: Prisma.TransactionClient, ctx: OperationContext, output: Output): Promise<void>
}

interface OperationContext {
  session: Session
  chat: ChatRecord
  userMessage: MessageRecord
  assistantMessage: MessageRecord
  history: HistoryTurn[]          // trimmed; untrusted
  scope: ReadableScope            // resolved at send time from current memberships
  sources: SourceSet
  model: ModelAdapter
  runs: RunLogger
  signal: AbortSignal
}
```

The orchestrator authorizes, resolves the operation, builds the context,
runs the handler, then calls `persist` and marks the message `COMPLETED` in
one transaction. Workflow logic (what to retrieve, how to prompt, what to
validate) lives in the handler. Handlers reuse retrieval and document
services but are not forced through one pipeline: Ask retrieves passages,
Review matches clauses to evidence, Compare aligns two versions, Draft
gathers a template's clauses.

### SourceSet

- Every passage a handler shows the model is registered first and given a
  short opaque ID (`S1` … `Sn`). The set maps each ID server-side to chunk
  ID, document ID, document version ID, version number, page range, section
  number and title, and the passage text.
- Prompts carry passages in delimited blocks labelled as evidence. System
  instructions say that text inside them is quoted material, never
  instructions.
- Model output may reference only IDs in the set. Anything else is dropped
  and counted in the run's metadata (`invalid_references`).
- The model never receives database IDs, file keys or other organizations'
  data, and its filenames or page numbers are never trusted: everything shown
  to the person about a source comes from the set.

### Execution and streaming

1. `POST messages` requires an `Idempotency-Key` header. In one transaction it
   inserts the user message and a `PENDING` assistant message, starts the
   orchestrator and returns both messages as JSON; a repeated key returns the
   existing pair without starting a second reply.
2. The orchestrator runs detached from the request. The browser then opens
   `GET stream`, an SSE stream fed by an in-process emitter (or the database,
   below); the browser disconnecting never aborts the work (only `cancel`
   does).
3. While streaming, the handler's text and status label are flushed to the
   assistant row about once a second, with `heartbeat_at`.
4. `GET stream` resumes from the database: a `snapshot` of the stored text and
   label, then the row is followed until a terminal state. This works from
   any Fly machine and after a reload.
5. States: `PENDING → STREAMING → COMPLETED | FAILED | CANCELLED`. A sweep marks
   rows whose heartbeat is older than 2 minutes `FAILED` with
   `error_code = STALLED`; the UI offers Retry, which sends a new message with
   the same text.
6. Long operations (3, 4) follow the same path through `ai_jobs`, emitting
   `progress` events.

`auto_stop_machines = 'off'` and `min_machines_running = 1` in
`apps/app/fly.toml` keep detached work alive between requests. A deploy
still kills it; the stall sweep turns that into a retryable failure.

### Event contract

`ChatStreamEvent` keeps `status`, `snapshot`, `delta` and `done`, and gains:

```ts
| { type: 'progress'; done: number; total: number; label: string }
| { type: 'citations'; citations: Citation[] }
| { type: 'findings'; findings: ReviewFinding[] }       // 3
| { type: 'changes'; changes: DocumentChange[] }        // 4
| { type: 'draft'; draft: DraftSummary }                // 5
| { type: 'error'; code: string; retryable: boolean }
```

The demo's mock keeps emitting `attachments` for its sample review, compare
and draft replies until those sub-projects replace them. Every source shown in an event carries
the document ID, version ID, version number, page and section taken from the
SourceSet.

### Authorization

- Every send checks `chat.create`, chat ownership (`chats.created_by`) and the
  operation's permission, and resolves the readable scope from current
  group membership through `visibleDocuments(session)`. A narrowed chat
  scope (`chat_collections`) is intersected with it on every turn, never
  trusted on its own.
- Every read (chat, messages, a citation's document) re-checks access. A
  citation to a document the person can no longer read shows "No longer
  available" with no title or text.
- IDs from another organization behave exactly like IDs that don't exist
  (404, no content).
- Gemini credentials stay server-side. `ai_runs` record provider, model,
  operation, tokens, latency and error codes, never prompts or passages.

## Schema plan

All changes are additive, so the deployed code keeps working on the migrated
schema. They keep composite `(organization_id, …)` foreign keys, enable RLS on
new tables, and add the `set_updated_at` trigger where a table has
`updated_at`. No new permission keys: Ask needs `chat.create`; Review and
Compare need `chat.create` plus read access to their subjects; Draft needs
`documents.generate`; approving templates needs `templates.manage`.

### 1 · Foundation + Ask

- `enum MessageStatus { PENDING STREAMING COMPLETED FAILED CANCELLED }`.
- `enum ChatOperation { ASK REVIEW COMPARE DRAFT }`.
- `chat_messages` gains `status` (default `COMPLETED`), `operation`,
  `idempotency_key` (unique on `(organization_id, created_by,
  idempotency_key)`), `error_code`, `heartbeat_at`, `completed_at`, `metadata`
  (json), `updated_at`.
- `chat_collections (organization_id, chat_id, collection_id)`: an optional
  narrowed scope; no rows means everything readable.
- `message_citations` gains `page_end`, `section_number`, `section_title`: a
  snapshot of the location, so a citation still reads right after
  re-indexing.
- `document_chunks` gains `search_vector tsvector` (`'simple'` configuration
  over section title and content), maintained by a trigger.
- No HNSW index yet: vector search is exact over one organization's eligible
  chunks (the reasoning in the `defer_embedding_index` migration), with a
  measured threshold for adding it (see the Foundation + Ask spec).

### 2 · Chat attachments

- `enum DocumentScope { KNOWLEDGE CHAT }`.
- `documents` gains `scope` (default `KNOWLEDGE`) and `chat_id`.
  `collection_id` becomes nullable, with a check that `KNOWLEDGE` requires a
  collection and `CHAT` a chat.
- `chat_attachments.document_id` links the attachment to that document.
- Knowledge lists, `visibleCollections`, `visibleDocuments` and retrieval
  filter on `scope`. The processor's reads are checked for assumptions about
  `collection_id`.

### 3 · Contract review

- `ai_jobs (organization_id, kind REVIEW|COMPARE, status, attempts,
  heartbeat_at, progress, total, error_code, started_at, completed_at,
  message_id)`: generic durable-job state.
- `document_reviews` gains `job_id`, `message_id` and `document_version_id`
  (the reviewed version, pinned).
- `review_references (review_id, document_version_id, role TEMPLATE|POLICY)`:
  the template and policy versions used.
- `review_findings` gains `section_number`, `section_title`, `page_end` and
  `chunk_id` (where the finding sits in the subject).
- `finding_evidence (finding_id, document_version_id, chunk_id, page,
  section, quoted_text, kind SUBJECT|TEMPLATE|POLICY)`.

### 4 · Version comparison

- `document_comparisons (job_id, message_id, base_version_id,
  target_version_id, status)`.
- `comparison_changes (comparison_id, change_type
  ADDED|REMOVED|MODIFIED|MOVED, significance HIGH|MEDIUM|LOW, base_section,
  target_section, base_text, target_text, summary, order)`.
- `change_evidence (change_id, document_version_id, chunk_id, page, section,
  quoted_text)`: policies each change affects.
- `ReviewType.COMPARISON` is left unused.

### 5 · Drafting

- `generated_documents` gains `message_id`, `template_id` and
  `template_version_id` (pinned).
- `generated_document_versions` gains `body` (json block tree: headings,
  paragraphs, lists, tables and `placeholder { key, label, required, value }`
  nodes; every block carries `provenance APPROVED_CLAUSE|GENERATED|EDITED` and
  its source chunk and version), `source GENERATION|EDIT|REGENERATION` and
  `exported_at`. `content` stays as derived markdown.
- A revision's DOCX is stored at `org/{org}/drafts/{id}/v{n}.docx` in the
  existing `file_key`; export always renders the exact revision chosen.

## Verification

No automated tests or evaluation harnesses: Dossier is a proof of concept.
Each sub-project is checked with `yarn types:check` and `yarn lint` (and
`make check` if the Go processor changes), then by hand in the running app
using the manual checks listed in its spec: permission boundaries,
cross-organization IDs, reloads and retries, and output quality on real
documents.

## Risks

| Risk | Handling |
|---|---|
| A deploy kills detached work | Heartbeat stall sweep → `FAILED` / `STALLED`, Retry |
| Long reviews cost too much | Per-operation model configuration, clauses batched per call, token totals in `ai_runs`; an AI budget per organization is a follow-up |
| Prompt injection from documents | Evidence-only delimiters, a fixed source set per handler, validated references; authorization never depends on the model |
| Prisma can't declare the tsvector GIN or HNSW indexes | The column is kept by a trigger (invisible to Prisma); both indexes wait until measurements need them (Foundation + Ask spec) |
| Clause segmentation from chunks is too coarse or too fine | Spec 3 first measures `section_number` and `heading_path` on real agreements; fallback is model-assisted clause splitting of the subject only |
| Development shares the production database | All AI tables are additive; manual checks run in a dedicated test workspace |
