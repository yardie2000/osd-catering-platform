-- ============================================================
-- OSD Catering Platform V4 — Production: kitchen station
-- Migration: 20260606000002_production_station
--
-- Adds a free-text `station` column to production_batches for
-- kitchen station assignment (timeline/station planning). planned_date
-- already exists. anon already has CRUD via 20260606000001.
-- Idempotent.
-- ============================================================

ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS station text;

COMMENT ON COLUMN public.production_batches.station IS
  'Optional kitchen station assignment (free text), e.g. "Kalte Küche", "Patisserie".';

NOTIFY pgrst, 'reload schema';
