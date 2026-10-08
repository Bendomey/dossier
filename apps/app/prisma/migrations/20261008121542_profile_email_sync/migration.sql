-- Every new table is closed to Supabase's REST API (see enable_row_level_security).
ALTER TABLE "invitation_groups" ENABLE ROW LEVEL SECURITY;

-- Keeps profiles.email equal to auth.users.email so member lists and
-- invitation matching never read the auth schema. Runs only where the auth
-- schema exists (Supabase); plain Postgres skips it.
DO $migration$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users not found; skipping profile email sync';
    RETURN;
  END IF;

  UPDATE "public"."profiles" p
  SET "email" = lower(u."email")
  FROM "auth"."users" u
  WHERE u."id" = p."id" AND p."email" IS DISTINCT FROM lower(u."email");

  CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $fn$
  BEGIN
    INSERT INTO "public"."profiles" ("id", "email", "display_name", "first_name", "last_name", "avatar_url", "updated_at")
    VALUES (
      new."id",
      lower(new."email"),
      COALESCE(new."raw_user_meta_data" ->> 'full_name', new."raw_user_meta_data" ->> 'name'),
      new."raw_user_meta_data" ->> 'given_name',
      new."raw_user_meta_data" ->> 'family_name',
      new."raw_user_meta_data" ->> 'avatar_url',
      now()
    )
    ON CONFLICT ("id") DO UPDATE SET "email" = EXCLUDED."email";
    RETURN new;
  END;
  $fn$;

  CREATE OR REPLACE FUNCTION "public"."handle_auth_user_email_change"()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $fn$
  BEGIN
    UPDATE "public"."profiles" SET "email" = lower(new."email") WHERE "id" = new."id";
    RETURN new;
  END;
  $fn$;

  REVOKE EXECUTE ON FUNCTION "public"."handle_auth_user_email_change"() FROM PUBLIC;

  DROP TRIGGER IF EXISTS "on_auth_user_email_changed" ON "auth"."users";
  CREATE TRIGGER "on_auth_user_email_changed"
    AFTER UPDATE OF "email" ON "auth"."users"
    FOR EACH ROW
    WHEN (old."email" IS DISTINCT FROM new."email")
    EXECUTE FUNCTION "public"."handle_auth_user_email_change"();
END
$migration$;
