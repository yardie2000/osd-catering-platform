-- ============================================================
-- OSD Catering Platform V3 — menu_items id default
-- Migration: 20260603000004_menu_items_id_default
--
-- The live menu_items.id column was created WITHOUT a default,
-- so inserts that don't supply an id fail with:
--   null value in column "id" of relation "menu_items"
--   violates not-null constraint
-- (this blocked every menu_items import).
--
-- Give id a server-side default. Idempotent: SET DEFAULT can be
-- re-run safely. gen_random_uuid() is built into Postgres 13+ /
-- Supabase.
-- ============================================================

ALTER TABLE public.menu_items ALTER COLUMN id SET DEFAULT gen_random_uuid();

NOTIFY pgrst, 'reload schema';
