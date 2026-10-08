-- Ties profiles to Supabase Auth. Runs only where the auth schema exists
-- (Supabase, or a local `supabase start`); plain Postgres skips it, which is
-- also what the shadow database used by `prisma migrate dev` sees.

DO $migration$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'auth.users not found; skipping Supabase Auth integration';
    RETURN;
  END IF;

  ALTER TABLE "public"."profiles"
    ADD CONSTRAINT "profiles_id_auth_users_fkey"
    FOREIGN KEY ("id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE;

  -- Every new Supabase user gets a profile, filled from the OAuth metadata
  -- Google and other providers supply.
  CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $fn$
  BEGIN
    INSERT INTO "public"."profiles" ("id", "display_name", "first_name", "last_name", "avatar_url", "updated_at")
    VALUES (
      new."id",
      COALESCE(new."raw_user_meta_data" ->> 'full_name', new."raw_user_meta_data" ->> 'name'),
      new."raw_user_meta_data" ->> 'given_name',
      new."raw_user_meta_data" ->> 'family_name',
      new."raw_user_meta_data" ->> 'avatar_url',
      now()
    )
    ON CONFLICT ("id") DO NOTHING;
    RETURN new;
  END;
  $fn$;

  REVOKE EXECUTE ON FUNCTION "public"."handle_new_auth_user"() FROM PUBLIC;

  DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
  CREATE TRIGGER "on_auth_user_created"
    AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_auth_user"();
END
$migration$;
