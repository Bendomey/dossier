-- Supabase exposes every table in `public` through its REST API (PostgREST).
-- The app reads and writes through Prisma on the server, connected as the
-- table owner, which bypasses RLS. Enabling RLS with no policies shuts the
-- REST route for the anon and authenticated roles without affecting the app.
-- Membership-based policies for direct client access are added on top of this.
-- Every new table needs the same line in its migration.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "role_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "indexing_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_citations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "generated_document_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "review_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- Prisma's bookkeeping table also lives in `public`. It does not exist in the
-- shadow database Prisma replays migrations into, hence the guard.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
