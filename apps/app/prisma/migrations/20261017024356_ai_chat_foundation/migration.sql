-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChatOperation" AS ENUM ('ASK', 'REVIEW', 'COMPARE', 'DRAFT');

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "completed_at" TIMESTAMPTZ(3),
ADD COLUMN     "error_code" TEXT,
ADD COLUMN     "heartbeat_at" TIMESTAMPTZ(3),
ADD COLUMN     "idempotency_key" TEXT,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "operation" "ChatOperation",
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "document_chunks" ADD COLUMN     "search_vector" tsvector;

-- AlterTable
ALTER TABLE "message_citations" ADD COLUMN     "page_end" INTEGER,
ADD COLUMN     "section_number" TEXT,
ADD COLUMN     "section_title" TEXT;

-- CreateTable
CREATE TABLE "chat_collections" (
    "organization_id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,

    CONSTRAINT "chat_collections_pkey" PRIMARY KEY ("chat_id","collection_id")
);

-- CreateIndex
CREATE INDEX "chat_collections_collection_id_idx" ON "chat_collections"("collection_id");

-- CreateIndex
CREATE INDEX "chat_messages_status_heartbeat_at_idx" ON "chat_messages"("status", "heartbeat_at");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_organization_id_created_by_idempotency_key_key" ON "chat_messages"("organization_id", "created_by", "idempotency_key");

-- AddForeignKey
ALTER TABLE "chat_collections" ADD CONSTRAINT "chat_collections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_collections" ADD CONSTRAINT "chat_collections_organization_id_chat_id_fkey" FOREIGN KEY ("organization_id", "chat_id") REFERENCES "chats"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_collections" ADD CONSTRAINT "chat_collections_organization_id_collection_id_fkey" FOREIGN KEY ("organization_id", "collection_id") REFERENCES "collections"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "chat_collections" ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER "chat_messages_set_updated_at" BEFORE UPDATE ON "chat_messages"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();

-- A trigger rather than a generated column: Prisma can't declare either, but
-- its diff ignores triggers. 'simple' because chunks are English, French or
-- Portuguese. Writers that never name this column (the Go processor) need no
-- grant for it.
CREATE OR REPLACE FUNCTION "document_chunks_set_search_vector"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW."search_vector" = to_tsvector('simple', coalesce(NEW."section_title", '') || ' ' || NEW."content");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "document_chunks_set_search_vector"
  BEFORE INSERT OR UPDATE OF "content", "section_title" ON "document_chunks"
  FOR EACH ROW EXECUTE FUNCTION "document_chunks_set_search_vector"();

UPDATE "document_chunks"
SET "search_vector" = to_tsvector('simple', coalesce("section_title", '') || ' ' || "content");
