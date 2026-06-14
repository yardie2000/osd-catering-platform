-- ============================================================
-- OSD Catering Platform V4.1 — Kitchen Production Batch
-- Migration: 20260606000003_kitchen_batches
--
-- Single operational planning entity. The user enters menus + pax
-- ONCE per batch; Production Output and Purchasing Output are both
-- derived (live) from the same batch. New tables (the existing
-- `production_batches` has a different per-recipe schema and is left
-- untouched / legacy).
--
-- Idempotent. anon CRUD (no login — browser uses the anon key),
-- mirroring 20260603000006 / 20260606000001.
-- ============================================================

create table if not exists public.kitchen_batches (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  description     text,
  start_date      date,
  end_date        date,
  production_date date,
  status          text        not null default 'planned',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.kitchen_batches is
  'Kitchen production batch (V4.1): the single data entry for a production run. Production & purchasing outputs are derived from its menu+pax items.';

create table if not exists public.kitchen_batch_items (
  id        uuid    primary key default gen_random_uuid(),
  batch_id  uuid    not null references public.kitchen_batches (id) on delete cascade,
  menu_id   uuid    not null references public.menus (id)           on delete restrict,
  pax_count integer not null default 0,
  constraint kitchen_batch_items_batch_menu_key unique (batch_id, menu_id)
);

create index if not exists idx_kitchen_batch_items_batch on public.kitchen_batch_items (batch_id);
create index if not exists idx_kitchen_batch_items_menu  on public.kitchen_batch_items (menu_id);

-- keep updated_at fresh on kitchen_batches (set_updated_at exists from V2 schema)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at') then
    drop trigger if exists kitchen_batches_updated_at on public.kitchen_batches;
    create trigger kitchen_batches_updated_at
      before update on public.kitchen_batches
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ── RLS: anon + authenticated full CRUD ──────────────────────
do $$
declare t text;
begin
  foreach t in array array['kitchen_batches','kitchen_batch_items']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'anon_write_' || t, t);
    execute format('create policy %I on public.%I for all to anon using (true) with check (true)', 'anon_write_' || t, t);
    execute format('drop policy if exists %I on public.%I', 'authenticated_all_' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'authenticated_all_' || t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
