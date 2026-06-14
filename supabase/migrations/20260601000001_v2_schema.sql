-- ============================================================
-- OSD Catering Platform V2 — Complete Database Schema
-- Migration: 20260601000001_v2_schema
-- ============================================================

-- ── helpers ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── units ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.units (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code         TEXT        NOT NULL,
  name              TEXT        NOT NULL,
  short_name        TEXT,
  base_unit         TEXT,
  conversion_factor NUMERIC(18,6),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT units_unit_code_key UNIQUE (unit_code)
);

COMMENT ON TABLE public.units IS 'Measurement units: g, kg, ml, l, Stk, etc.';

CREATE TRIGGER units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ingredients ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ingredients (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_code  TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  category         TEXT,
  default_unit_id  UUID        REFERENCES public.units (id) ON DELETE SET NULL,
  supplier_name    TEXT,
  allergens        TEXT[]      NOT NULL DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ingredients_ingredient_code_key UNIQUE (ingredient_code)
);

COMMENT ON TABLE public.ingredients IS 'Master ingredient list; foundation for purchasing and allergen tracking.';

CREATE TRIGGER ingredients_updated_at
  BEFORE UPDATE ON public.ingredients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── recipes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_code      TEXT        NOT NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  yield_quantity   NUMERIC(12,4),
  yield_unit_id    UUID        REFERENCES public.units (id) ON DELETE SET NULL,
  preparation      TEXT,
  usage_notes      TEXT,
  production_notes TEXT,
  shelf_life       TEXT,
  scalable         BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT recipes_recipe_code_key UNIQUE (recipe_code)
);

COMMENT ON TABLE public.recipes IS 'Recipe master data; scalable, linked to ingredients and menus.';

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── recipe_ingredients ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     UUID          NOT NULL REFERENCES public.recipes (id) ON DELETE CASCADE,
  ingredient_id UUID          NOT NULL REFERENCES public.ingredients (id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,4) NOT NULL CHECK (quantity > 0),
  unit_id       UUID          NOT NULL REFERENCES public.units (id) ON DELETE RESTRICT,
  supplier      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.recipe_ingredients IS 'Ingredient lines per recipe; drives cost calculation and purchasing.';

-- ── menus ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.menus (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_code   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  category    TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT menus_menu_code_key UNIQUE (menu_code)
);

COMMENT ON TABLE public.menus IS 'Menu master data; a menu groups recipes for events.';

CREATE TRIGGER menus_updated_at
  BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── menu_recipes ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.menu_recipes (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id         UUID          NOT NULL REFERENCES public.menus (id) ON DELETE CASCADE,
  recipe_id       UUID          NOT NULL REFERENCES public.recipes (id) ON DELETE RESTRICT,
  portion_count   NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (portion_count > 0),
  portion_unit_id UUID          REFERENCES public.units (id) ON DELETE SET NULL,
  sort_order      INTEGER       NOT NULL DEFAULT 0,
  CONSTRAINT menu_recipes_menu_recipe_key UNIQUE (menu_id, recipe_id)
);

COMMENT ON TABLE public.menu_recipes IS 'Recipe assignments within a menu, with portion counts.';

-- ── import_jobs ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.import_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  filename    TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','running','completed','failed','rolled_back','dry_run')),
  dry_run     BOOLEAN     NOT NULL DEFAULT false,
  total_rows  INTEGER     NOT NULL DEFAULT 0,
  inserted    INTEGER     NOT NULL DEFAULT 0,
  updated     INTEGER     NOT NULL DEFAULT 0,
  skipped     INTEGER     NOT NULL DEFAULT 0,
  errors      INTEGER     NOT NULL DEFAULT 0,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_by  TEXT
);

COMMENT ON TABLE public.import_jobs IS 'One record per Excel import operation; parent of data_import_log.';

-- ── data_import_log ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_import_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID        NOT NULL REFERENCES public.import_jobs (id) ON DELETE CASCADE,
  severity      TEXT        NOT NULL DEFAULT 'info'
                            CHECK (severity IN ('info','warning','error')),
  message       TEXT        NOT NULL,
  row_number    INTEGER,
  source_sheet  TEXT,
  entity_type   TEXT,
  entity_code   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.data_import_log IS 'Per-row audit log for import operations.';

-- ── future architecture stubs ─────────────────────────────────
-- These tables are scaffolded for future modules. No UI or logic
-- is implemented in V2. They exist to anchor foreign keys as
-- the platform grows.

CREATE TABLE IF NOT EXISTS public.events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code  TEXT        NOT NULL UNIQUE,
  name        TEXT        NOT NULL,
  event_date  DATE,
  guest_count INTEGER,
  status      TEXT        NOT NULL DEFAULT 'draft',
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.events IS '[FUTURE] Catering events; each event references one or more menus.';

CREATE TABLE IF NOT EXISTS public.event_menus (
  id        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID    NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  menu_id   UUID    NOT NULL REFERENCES public.menus (id) ON DELETE RESTRICT,
  guest_count INTEGER,
  CONSTRAINT event_menus_event_menu_key UNIQUE (event_id, menu_id)
);

COMMENT ON TABLE public.event_menus IS '[FUTURE] Menus assigned to an event.';

CREATE TABLE IF NOT EXISTS public.suppliers (
  id            UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code TEXT  NOT NULL UNIQUE,
  name          TEXT  NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  notes         TEXT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.suppliers IS '[FUTURE] Supplier master data for purchasing.';

CREATE TABLE IF NOT EXISTS public.purchasing_lists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID        REFERENCES public.events (id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'draft',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.purchasing_lists IS '[FUTURE] Aggregated purchasing list per event.';

CREATE TABLE IF NOT EXISTS public.purchasing_list_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  purchasing_list_id  UUID          NOT NULL REFERENCES public.purchasing_lists (id) ON DELETE CASCADE,
  ingredient_id       UUID          NOT NULL REFERENCES public.ingredients (id),
  quantity_needed     NUMERIC(12,4) NOT NULL,
  unit_id             UUID          NOT NULL REFERENCES public.units (id),
  supplier_id         UUID          REFERENCES public.suppliers (id),
  unit_price          NUMERIC(12,4),
  notes               TEXT
);

COMMENT ON TABLE public.purchasing_list_items IS '[FUTURE] Line items in a purchasing list.';

CREATE TABLE IF NOT EXISTS public.production_batches (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID        REFERENCES public.events (id) ON DELETE SET NULL,
  recipe_id    UUID        NOT NULL REFERENCES public.recipes (id),
  batch_size   NUMERIC(12,4) NOT NULL,
  unit_id      UUID        NOT NULL REFERENCES public.units (id),
  planned_date DATE,
  status       TEXT        NOT NULL DEFAULT 'planned',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.production_batches IS '[FUTURE] Production batch planning per recipe and event.';

-- ── indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ingredients_name          ON public.ingredients (name);
CREATE INDEX IF NOT EXISTS idx_ingredients_category      ON public.ingredients (category);
CREATE INDEX IF NOT EXISTS idx_ingredients_supplier      ON public.ingredients (supplier_name);
CREATE INDEX IF NOT EXISTS idx_recipes_name              ON public.recipes (name);
CREATE INDEX IF NOT EXISTS idx_recipes_scalable          ON public.recipes (scalable);
CREATE INDEX IF NOT EXISTS idx_recipe_ingr_recipe        ON public.recipe_ingredients (recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingr_ingredient    ON public.recipe_ingredients (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingr_unit          ON public.recipe_ingredients (unit_id);
CREATE INDEX IF NOT EXISTS idx_menu_recipes_menu         ON public.menu_recipes (menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_recipes_recipe       ON public.menu_recipes (recipe_id);
CREATE INDEX IF NOT EXISTS idx_menus_active              ON public.menus (active);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status        ON public.import_jobs (status);
CREATE INDEX IF NOT EXISTS idx_import_log_job            ON public.data_import_log (import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_log_severity       ON public.data_import_log (severity);

-- ── row level security ───────────────────────────────────────

ALTER TABLE public.units                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_recipes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_menus           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchasing_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchasing_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_batches    ENABLE ROW LEVEL SECURITY;

-- Authenticated: full access to all tables
CREATE POLICY "authenticated_all_units"                 ON public.units                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_ingredients"           ON public.ingredients           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_recipes"               ON public.recipes               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_recipe_ingredients"    ON public.recipe_ingredients    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_menus"                 ON public.menus                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_menu_recipes"          ON public.menu_recipes          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_import_jobs"           ON public.import_jobs           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_data_import_log"       ON public.data_import_log       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_events"                ON public.events                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_event_menus"           ON public.event_menus           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_suppliers"             ON public.suppliers             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_purchasing_lists"      ON public.purchasing_lists      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_purchasing_list_items" ON public.purchasing_list_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_production_batches"    ON public.production_batches    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon: read-only on master data (recipes, ingredients, menus, units)
CREATE POLICY "anon_select_units"             ON public.units             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_ingredients"       ON public.ingredients       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_recipes"           ON public.recipes           FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_recipe_ingr"       ON public.recipe_ingredients FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_menus"             ON public.menus             FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_menu_recipes"      ON public.menu_recipes      FOR SELECT TO anon USING (true);
