-- ============================================================
-- OSD Catering Platform V3 — Menus & Menu Items upgrade
-- Migration: 20260603000001_v3_menus_items
--
-- Changes:
--   menus: rename name→menu_name, description→menu_description,
--          drop service_note and menu_type (not in V3 spec)
--   menu_items: new table replacing menu_recipes (simpler schema)
--   data: migrated from menu_recipes before drop
-- ============================================================

-- ── menus: align column names with V3 spec ───────────────────

ALTER TABLE public.menus RENAME COLUMN name        TO menu_name;
ALTER TABLE public.menus RENAME COLUMN description TO menu_description;

-- service_note was added in migration 2 but is not in V3 spec
ALTER TABLE public.menus DROP COLUMN IF EXISTS service_note;
-- menu_type was in TypeScript types but never in SQL; safe no-op
ALTER TABLE public.menus DROP COLUMN IF EXISTS menu_type;

-- menu_code is logically required; enforce NOT NULL
ALTER TABLE public.menus ALTER COLUMN menu_code SET NOT NULL;

COMMENT ON TABLE public.menus IS 'Sellable catering menu packages; each menu groups multiple recipes.';

-- ── menu_items ────────────────────────────────────────────────
-- Replaces menu_recipes. Simpler schema: no portion_count/unit.

CREATE TABLE IF NOT EXISTS public.menu_items (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id    UUID        NOT NULL REFERENCES public.menus   (id) ON DELETE CASCADE,
  recipe_id  UUID        NOT NULL REFERENCES public.recipes (id) ON DELETE RESTRICT,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT menu_items_menu_recipe_key UNIQUE (menu_id, recipe_id)
);

COMMENT ON TABLE public.menu_items IS 'Recipe assignments within a menu, ordered by sort_order.';

CREATE TRIGGER menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── migrate existing menu_recipes data ───────────────────────

INSERT INTO public.menu_items (menu_id, recipe_id, sort_order)
SELECT menu_id, recipe_id, sort_order
FROM   public.menu_recipes
ON CONFLICT DO NOTHING;

-- ── indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_menu_items_menu   ON public.menu_items (menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_recipe ON public.menu_items (recipe_id);

-- ── row level security ────────────────────────────────────────

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_all_menu_items"
  ON public.menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "anon_select_menu_items"
  ON public.menu_items FOR SELECT TO anon USING (true);

-- ── drop old table ────────────────────────────────────────────
-- Safe: data already copied above; event_menus.menu_id references
-- menus not menu_recipes so no FK conflict here.

DROP TABLE IF EXISTS public.menu_recipes;
