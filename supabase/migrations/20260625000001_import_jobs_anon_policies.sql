-- ============================================================
-- OSD Catering Platform — anon RLS for import history
-- Migration: 20260625000001_import_jobs_anon_policies
--
-- The browser app (lib/supabase/client.ts) uses the ANON key and has
-- no login flow, so every request runs as role `anon`. The Excel
-- importer (lib/importers/ExcelImportEngine.ts) creates an `import_jobs`
-- row as its FIRST step and writes per-row `data_import_log` entries.
--
-- v2_schema enabled RLS on both tables but only added an
-- `authenticated_*` policy — NO `anon` policy. The later
-- `anon_write_policies` (…0006) and `persistence_policies` (…0001 V4)
-- migrations covered the data tables but MISSED these two. Effect:
--   • anon INSERT on import_jobs  → RLS denied → import aborts with
--     "Failed to create import job"
--   • anon SELECT on import_jobs  → RLS returns 0 rows → the
--     "Importverlauf" UI is always empty
--
-- This grants the anon role full CRUD on the two import-history tables,
-- mirroring 20260603000006_anon_write_policies. Idempotent.
--
-- ⚠️ SECURITY: same caveat as …0006/…0001 — the anon key ships in the
-- browser, so this lets anyone reaching the project URL write to these
-- tables. Appropriate for an internal/local tool. For a PUBLIC
-- deployment, add real authentication and keep writes on `authenticated`.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['import_jobs','data_import_log']
  loop
    -- ensure RLS is on (no-op if already enabled)
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'anon_write_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      'anon_write_' || t, t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
