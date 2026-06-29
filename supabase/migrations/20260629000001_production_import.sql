-- ============================================================
-- OSD Catering Platform — Produktbedarf → Produktion Import
-- Migration: 20260629000001_production_import
--
-- Übernimmt geprüfte Bedarf-Importe (imported_events) in einen
-- Produktionslauf (kitchen_batches). Anders als die manuelle Eingabe
-- (Menü + Pax fürs ganze Menü) muss der Import die im Review TATSÄCHLICH
-- gewählten Positionen abbilden — sonst überproduziert die Küche bei
-- Auswahl-Menüs ("6 Teile").
--
-- 1) kitchen_batch_item_positions: pro Batch-Item die gewählten Positionen.
--    Leer = ganzes Menü (rückwärtskompatibel zu manuell angelegten Items).
-- 2) Unique(batch_id, menu_id) entfällt: dasselbe Menü kann mit
--    unterschiedlicher Positionsauswahl + eigener Pax mehrfach vorkommen.
-- 3) kitchen_batches.source_import_job_id: Herkunft/Rückverfolgbarkeit.
--
-- Idempotent. anon + authenticated CRUD (Browser nutzt den anon key),
-- analog zu 20260606000003_kitchen_batches.
-- ============================================================

-- 1) Herkunfts-Spalte am Produktionslauf ----------------------
alter table public.kitchen_batches
  add column if not exists source_import_job_id uuid
    references public.import_jobs (id) on delete set null;

create index if not exists idx_kitchen_batches_source_job
  on public.kitchen_batches (source_import_job_id);

-- 2) Unique(batch_id, menu_id) entfernen ----------------------
-- Ein Menü kann pro Lauf mehrfach auftreten (verschiedene Auswahl-Sets).
alter table public.kitchen_batch_items
  drop constraint if exists kitchen_batch_items_batch_menu_key;

-- 3) Gewählte Positionen je Batch-Item ------------------------
create table if not exists public.kitchen_batch_item_positions (
  id            uuid primary key default gen_random_uuid(),
  batch_item_id uuid not null references public.kitchen_batch_items (id) on delete cascade,
  position_id   uuid not null references public.positions (id)          on delete cascade,
  constraint kitchen_batch_item_positions_item_pos_key unique (batch_item_id, position_id)
);

comment on table public.kitchen_batch_item_positions is
  'Im Bedarf-Import gewählte Positionen eines Batch-Items. Vorhanden → Produktion nur dieser Positionen; leer → ganzes Menü.';

create index if not exists idx_kbip_item     on public.kitchen_batch_item_positions (batch_item_id);
create index if not exists idx_kbip_position on public.kitchen_batch_item_positions (position_id);

-- ── RLS: anon + authenticated full CRUD ──────────────────────
do $$
begin
  execute 'alter table public.kitchen_batch_item_positions enable row level security';
  execute 'drop policy if exists anon_write_kitchen_batch_item_positions on public.kitchen_batch_item_positions';
  execute 'create policy anon_write_kitchen_batch_item_positions on public.kitchen_batch_item_positions for all to anon using (true) with check (true)';
  execute 'drop policy if exists authenticated_all_kitchen_batch_item_positions on public.kitchen_batch_item_positions';
  execute 'create policy authenticated_all_kitchen_batch_item_positions on public.kitchen_batch_item_positions for all to authenticated using (true) with check (true)';
end $$;

notify pgrst, 'reload schema';
