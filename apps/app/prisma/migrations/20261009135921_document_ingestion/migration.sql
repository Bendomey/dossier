/*
  Warnings:

  - A unique constraint covering the columns `[indexing_job_id,chunk_index]` on the table `document_chunks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[upload_id]` on the table `document_versions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,id]` on the table `indexing_jobs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "IndexingStage" AS ENUM ('EXTRACTING', 'CHUNKING', 'EMBEDDING', 'ACTIVATING');

-- CreateEnum
CREATE TYPE "IndexingTrigger" AS ENUM ('UPLOAD', 'RETRY', 'REINDEX');

-- AlterEnum
ALTER TYPE "AiOperation" ADD VALUE 'OCR';

-- DropIndex
DROP INDEX "document_chunks_document_version_id_chunk_index_key";

-- DropIndex
DROP INDEX "indexing_jobs_document_version_id_idx";

-- AlterTable
ALTER TABLE "document_chunks" ADD COLUMN     "indexing_job_id" UUID,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "page_end" INTEGER,
ADD COLUMN     "section_number" TEXT;

-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN     "indexed_job_id" UUID,
ADD COLUMN     "page_count" INTEGER,
ADD COLUMN     "upload_id" UUID;

-- AlterTable
ALTER TABLE "indexing_jobs" ADD COLUMN     "completed_chunk_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "created_by" UUID,
ADD COLUMN     "embedding_model" TEXT,
ADD COLUMN     "error_code" TEXT,
ADD COLUMN     "error_stage" "IndexingStage",
ADD COLUMN     "expected_chunk_count" INTEGER,
ADD COLUMN     "heartbeat_at" TIMESTAMPTZ(3),
ADD COLUMN     "ocr_model" TEXT,
ADD COLUMN     "ocr_page_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pipeline_version" TEXT,
ADD COLUMN     "stage" "IndexingStage",
ADD COLUMN     "triggered_by" "IndexingTrigger" NOT NULL DEFAULT 'UPLOAD';

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_usage" (
    "organization_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "pages_reserved" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_usage_pkey" PRIMARY KEY ("organization_id","period")
);

-- CreateIndex
CREATE INDEX "outbox_events_organization_id_aggregate_id_idx" ON "outbox_events"("organization_id", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_chunks_indexing_job_id_chunk_index_key" ON "document_chunks"("indexing_job_id", "chunk_index");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_upload_id_key" ON "document_versions"("upload_id");

-- CreateIndex
CREATE INDEX "indexing_jobs_document_version_id_created_at_idx" ON "indexing_jobs"("document_version_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "indexing_jobs_organization_id_id_key" ON "indexing_jobs"("organization_id", "id");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_organization_id_indexed_job_id_fkey" FOREIGN KEY ("organization_id", "indexed_job_id") REFERENCES "indexing_jobs"("organization_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_organization_id_indexing_job_id_fkey" FOREIGN KEY ("organization_id", "indexing_job_id") REFERENCES "indexing_jobs"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_usage" ADD CONSTRAINT "ocr_usage_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: partial indexes, checks, trigger, RLS, and the roles the
-- indexing Worker and Go processor connect as.

CREATE INDEX "outbox_events_unpublished_idx"
  ON "outbox_events" ("created_at") WHERE "published_at" IS NULL;
CREATE INDEX "indexing_jobs_processing_heartbeat_idx"
  ON "indexing_jobs" ("heartbeat_at") WHERE "status" = 'PROCESSING';

ALTER TABLE "indexing_jobs" ADD CONSTRAINT "indexing_jobs_chunk_counts_check"
  CHECK ("completed_chunk_count" >= 0 AND COALESCE("expected_chunk_count", 0) >= 0 AND "ocr_page_count" >= 0);
ALTER TABLE "ocr_usage" ADD CONSTRAINT "ocr_usage_pages_reserved_check" CHECK ("pages_reserved" >= 0);
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_page_count_check"
  CHECK ("page_count" IS NULL OR "page_count" >= 0);

CREATE TRIGGER "ocr_usage_set_updated_at" BEFORE UPDATE ON "ocr_usage"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ocr_usage" ENABLE ROW LEVEL SECURITY;

-- Roles are created without LOGIN; passwords and LOGIN are set by hand in
-- Supabase, never in a migration. Neither role bypasses RLS: each table they
-- use gets a policy for that role, and grants limit what they may do.
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'indexing_processor') THEN
    CREATE ROLE "indexing_processor" NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'indexing_worker') THEN
    CREATE ROLE "indexing_worker" NOLOGIN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    GRANT USAGE ON SCHEMA "extensions" TO "indexing_processor";
  END IF;
END
$roles$;

GRANT USAGE ON SCHEMA "public" TO "indexing_processor", "indexing_worker";

GRANT SELECT ON "documents", "document_versions", "indexing_jobs" TO "indexing_processor";
GRANT UPDATE ("current_version_id") ON "documents" TO "indexing_processor";
GRANT UPDATE ("checksum", "language", "page_count", "indexed_job_id") ON "document_versions" TO "indexing_processor";
GRANT UPDATE ("status", "stage", "progress", "attempts", "error_stage", "error_code", "error_message",
  "heartbeat_at", "pipeline_version", "embedding_model", "ocr_model", "expected_chunk_count",
  "completed_chunk_count", "ocr_page_count", "started_at", "completed_at") ON "indexing_jobs" TO "indexing_processor";
GRANT SELECT, INSERT, UPDATE, DELETE ON "document_chunks" TO "indexing_processor";
GRANT SELECT, INSERT, UPDATE ON "ocr_usage" TO "indexing_processor";
GRANT INSERT ON "ai_runs", "audit_logs" TO "indexing_processor";

GRANT SELECT, INSERT, UPDATE ON "outbox_events" TO "indexing_worker";
GRANT SELECT ON "indexing_jobs", "document_versions" TO "indexing_worker";
GRANT UPDATE ("status", "error_code", "error_stage", "completed_at") ON "indexing_jobs" TO "indexing_worker";
GRANT INSERT ON "audit_logs" TO "indexing_worker";

CREATE POLICY "indexing_processor_all" ON "documents" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_processor_all" ON "document_versions" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_processor_all" ON "indexing_jobs" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_processor_all" ON "document_chunks" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_processor_all" ON "ocr_usage" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_processor_all" ON "ai_runs" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_processor_all" ON "audit_logs" FOR ALL TO "indexing_processor" USING (true) WITH CHECK (true);

CREATE POLICY "indexing_worker_all" ON "outbox_events" FOR ALL TO "indexing_worker" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_worker_all" ON "indexing_jobs" FOR ALL TO "indexing_worker" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_worker_all" ON "document_versions" FOR ALL TO "indexing_worker" USING (true) WITH CHECK (true);
CREATE POLICY "indexing_worker_all" ON "audit_logs" FOR ALL TO "indexing_worker" USING (true) WITH CHECK (true);
