-- ============================================================
-- OSD Catering Platform V4 — Menu Item ↔ Recipe linkage
-- Migration: 20260605000001_menu_items_recipe_link
--
-- Unifies the menu_items <-> recipes relationship across the
-- (divergent) repo migrations and the live database.
--
-- Reality check (live DB, verified 2026-06-05):
--   * menu_items already has a NULLABLE recipe_id column and a
--     working FK to recipes (PostgREST embeds resolve), but every
--     row currently has recipe_id = NULL (nothing linked yet).
--   * menu_items is the standalone-line model:
--       id, menu_id, name, description, dietary, item_price,
--       sort_order, allergens, recipe_id.
--
-- Fresh-deploy reality (migration 20260603000001):
--   * menu_items.recipe_id was created NOT NULL, ON DELETE RESTRICT,
--     with a unique(menu_id, recipe_id) constraint.
--
-- This migration makes BOTH states converge on the intended V4
-- model: recipe_id is an OPTIONAL reference — a menu line may or
-- may not be backed by a recipe. It is fully idempotent.
-- ============================================================

-- 1) Ensure the column exists (no-op on live; covers partial states).
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS recipe_id uuid;

-- 2) recipe_id must be optional: standalone menu lines have no recipe.
--    Fresh deploys created it NOT NULL — relax that here.
ALTER TABLE public.menu_items
  ALTER COLUMN recipe_id DROP NOT NULL;

-- 3) Drop the rigid unique(menu_id, recipe_id) constraint if present.
--    The same recipe may legitimately appear in several menu lines
--    (different courses / portions), and most lines carry NULL.
ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_menu_recipe_key;

-- 4) Ensure a foreign key recipe_id -> recipes(id) exists.
--    Added only if NO FK on recipe_id is present, so the constraint
--    the live DB already has is left untouched. New FKs use
--    ON DELETE SET NULL: deleting a recipe simply unlinks the line.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.key_column_usage  kcu
           ON  tc.constraint_name = kcu.constraint_name
           AND tc.table_schema    = kcu.table_schema
    WHERE  tc.table_schema    = 'public'
      AND  tc.table_name      = 'menu_items'
      AND  tc.constraint_type = 'FOREIGN KEY'
      AND  kcu.column_name    = 'recipe_id'
  ) THEN
    ALTER TABLE public.menu_items
      ADD CONSTRAINT menu_items_recipe_id_fkey
      FOREIGN KEY (recipe_id) REFERENCES public.recipes (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 5) Index for recipe-based lookups / joins.
CREATE INDEX IF NOT EXISTS idx_menu_items_recipe
  ON public.menu_items (recipe_id);

-- 6) Conservative one-off backfill. Link a menu line to a recipe ONLY
--    when its name matches exactly one recipe name (case-insensitive)
--    and the line is not already linked. No fuzzy guessing — ambiguous
--    or non-matching lines stay NULL and are linked via the UI picker.
--    (For the current dataset this links 0 rows by design, because
--    menu line names are composite descriptions, not recipe names.)
UPDATE public.menu_items mi
SET    recipe_id = r.id
FROM   public.recipes r
WHERE  mi.recipe_id IS NULL
  AND  lower(btrim(mi.name)) = lower(btrim(r.name))
  AND  (
    SELECT count(*) FROM public.recipes r2
    WHERE lower(btrim(r2.name)) = lower(btrim(r.name))
  ) = 1;

COMMENT ON COLUMN public.menu_items.recipe_id IS
  'Optional reference to the recipe backing this menu line. NULL = standalone line (no recipe yet). Linked/repaired via the menu detail UI.';

-- 7) Reload PostgREST schema cache so embeds pick up any new FK.
NOTIFY pgrst, 'reload schema';
