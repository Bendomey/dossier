-- Keeps updated_at current for writes that do not go through Prisma (the
-- Workers and Go services in services/*). Prisma sets the same value itself;
-- the trigger simply makes the column trustworthy for every writer.

CREATE OR REPLACE FUNCTION "set_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updated_at" = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "organizations_set_updated_at" BEFORE UPDATE ON "organizations"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "organization_members_set_updated_at" BEFORE UPDATE ON "organization_members"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "groups_set_updated_at" BEFORE UPDATE ON "groups"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "collections_set_updated_at" BEFORE UPDATE ON "collections"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "documents_set_updated_at" BEFORE UPDATE ON "documents"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "document_templates_set_updated_at" BEFORE UPDATE ON "document_templates"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "chats_set_updated_at" BEFORE UPDATE ON "chats"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
CREATE TRIGGER "generated_documents_set_updated_at" BEFORE UPDATE ON "generated_documents"
  FOR EACH ROW EXECUTE FUNCTION "set_updated_at"();
