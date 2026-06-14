-- ============================================================
-- OSD Catering Platform V3 — menus column alignment
-- Migration: 20260603000003_menus_price_per_person
--
-- The Menu importer and the app UI write `price_per_person`
-- (and rely on menu_description / category / active) on the
-- menus table. If the live table is missing any of these, every
-- menu INSERT fails with:
--   Could not find the 'price_per_person' column of 'menus'
-- ...which also cascades to menu_items (no menuMap -> all skipped).
--
-- This migration adds any missing columns. It is IDEMPOTENT:
-- ADD COLUMN IF NOT EXISTS is a no-op when the column is present.
-- ============================================================

ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS price_per_person numeric;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS menu_description text;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS category         text;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS active           boolean NOT NULL DEFAULT true;

-- Make the new relationship/columns visible to the API immediately.
NOTIFY pgrst, 'reload schema';
