-- Runs after migrations. Supabase exposes the public schema through its REST API; the app connects as
-- the table owner, so row level security without policies blocks that API while leaving the app unaffected.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
  END IF;
END $$;
-- On Supabase, create the storage buckets for posters (public) and receipts/proofs (private).
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('media','media',true),('private','private',false) ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Create the "media" (public) and "private" storage buckets in the Supabase dashboard.';
END $$;
