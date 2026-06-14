-- ============================================================
-- OSD Catering Platform V3 — allow UI writes (anon role)
-- Migration: 20260603000006_anon_write_policies
--
-- The browser app (lib/supabase/client.ts) uses the ANON key and
-- there is no login flow, so every UI request runs as role `anon`.
-- The existing RLS policies only grant anon SELECT, so every
-- create/update/delete from the UI fails with:
--   new row violates row-level security policy for table "..."
-- (surfaced in the UI as "[object Object]").
--
-- This grants the anon role full CRUD on the tables the UI edits.
-- Idempotent: each policy is dropped-if-exists then recreated.
--
-- ⚠️ SECURITY: the anon key is shipped to the browser, so this lets
-- anyone who can reach the project URL write to these tables. That is
-- appropriate for an internal / local-only tool. For a PUBLIC
-- deployment, add real authentication instead and keep writes on the
-- `authenticated` role.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['units','ingredients','recipes','recipe_ingredients','menus','menu_items']
  loop
    execute format('drop policy if exists %I on public.%I', 'anon_write_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      'anon_write_' || t, t
    );
  end loop;
end $$;

notify pgrst, 'reload schema';
