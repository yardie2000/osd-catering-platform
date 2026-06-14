-- ============================================================
-- OSD Catering Platform V4 — Persistence for Purchasing & Production
-- Migration: 20260606000001_persistence_policies
--
-- Enables the browser app (anon role, no login) to SAVE calculated
-- purchasing lists and production batches, and ensures a "Portion"
-- unit exists for production_batches (unit_id is NOT NULL).
--
-- Idempotent. Mirrors 20260603000006_anon_write_policies for the
-- three persistence tables.
--
-- ⚠️ SECURITY: same caveat as migration …0006 — the anon key is in
-- the browser, so this lets anyone reaching the project URL write to
-- these tables. Appropriate for an internal/local tool; for a public
-- deployment, add real auth and keep writes on `authenticated`.
-- ============================================================

-- ── anon full CRUD on the persistence tables ─────────────────
do $$
declare t text;
begin
  foreach t in array array['purchasing_lists','purchasing_list_items','production_batches']
  loop
    -- ensure RLS is on (no-op if already enabled)
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'anon_write_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      'anon_write_' || t, t
    );
    -- keep authenticated full access too (idempotent)
    execute format('drop policy if exists %I on public.%I', 'authenticated_all_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'authenticated_all_' || t, t
    );
  end loop;
end $$;

-- ── ensure a "Portion" unit exists ───────────────────────────
-- production_batches.batch_size counts portions; unit_id is NOT NULL.
insert into public.units (id, unit_code, name, short_name, created_at, updated_at)
values (gen_random_uuid(), 'portion', 'Portion', 'Port.', now(), now())
on conflict (unit_code) do nothing;

notify pgrst, 'reload schema';
