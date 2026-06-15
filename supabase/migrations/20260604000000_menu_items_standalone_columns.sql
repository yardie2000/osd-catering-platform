-- ============================================================
-- OSD Catering Platform — menu_items standalone line-item columns
-- Migration: 20260604000000_menu_items_standalone_columns
--
-- Gap fix: menu_items was created in 20260603000001 as a pure menu↔recipe
-- link (menu_id + recipe_id NOT NULL). It later became standalone line items
-- with name/description/dietary/item_price and an OPTIONAL recipe link — but
-- those columns were only ever added directly in the live DB, never captured
-- as a migration. Without them the schema cannot be rebuilt from scratch
-- (the 20260605000001 recipe-link backfill references mi.name).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP NOT NULL (no-op when already so).
-- name stays nullable at the DB level (app-required, DB-lenient) so existing
-- link rows migrated from menu_recipes remain valid.
-- ============================================================

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS name        text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS dietary     text,
  ADD COLUMN IF NOT EXISTS item_price  numeric(10,2);

-- A menu line may be standalone (no recipe yet) → recipe_id must be nullable.
ALTER TABLE public.menu_items ALTER COLUMN recipe_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
