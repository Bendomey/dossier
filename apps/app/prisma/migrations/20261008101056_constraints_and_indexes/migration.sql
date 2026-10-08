-- Rules Prisma cannot express in schema.prisma. Prisma Migrate leaves these
-- alone (it does not manage check constraints, partial indexes or vector
-- indexes), so they survive later `migrate dev` runs.

-- Nearest-neighbour search over chunk embeddings (cosine distance).
CREATE INDEX "document_chunks_embedding_idx"
  ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- System roles are shared by every organization; custom roles belong to one.
ALTER TABLE "roles" ADD CONSTRAINT "roles_system_scope_check"
  CHECK (("is_system" AND "organization_id" IS NULL) OR (NOT "is_system" AND "organization_id" IS NOT NULL));
CREATE UNIQUE INDEX "roles_system_name_key" ON "roles" ("name") WHERE "organization_id" IS NULL;

-- One built-in Everyone group per organization.
CREATE UNIQUE INDEX "groups_one_system_group_key" ON "groups" ("organization_id") WHERE "is_system";

ALTER TABLE "collections" ADD CONSTRAINT "collections_not_own_parent_check"
  CHECK ("parent_id" IS NULL OR "parent_id" <> "id");

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_version_number_check" CHECK ("version_number" > 0);
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_file_size_check" CHECK ("file_size" >= 0);
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_file_size_check" CHECK ("file_size" >= 0);

ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_progress_check" CHECK ("progress" BETWEEN 0 AND 100);
ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_attempts_check" CHECK ("attempts" >= 0);

ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_chunk_index_check" CHECK ("chunk_index" >= 0);
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_token_count_check" CHECK ("token_count" >= 0);

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sequence_check" CHECK ("sequence" >= 0);

ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_relevance_score_check"
  CHECK ("relevance_score" IS NULL OR "relevance_score" BETWEEN 0 AND 1);
ALTER TABLE "message_citations" ADD CONSTRAINT "message_citations_citation_order_check" CHECK ("citation_order" > 0);

ALTER TABLE "generated_document_versions" ADD CONSTRAINT "generated_document_versions_version_number_check"
  CHECK ("version_number" > 0);

ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_usage_check"
  CHECK (COALESCE("input_tokens", 0) >= 0 AND COALESCE("output_tokens", 0) >= 0 AND COALESCE("latency_ms", 0) >= 0);

ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_email_check"
  CHECK ("email" = lower("email") AND position('@' in "email") > 1);
