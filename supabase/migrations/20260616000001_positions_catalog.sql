-- ============================================================
-- OSD Catering — Positions-Katalog (geteilte Positionen)
-- Migration: 20260616000001_positions_catalog
--
-- Führt Positionen als eigenständigen, wiederverwendbaren Katalog ein:
--   positions            — Stammdaten einer Position
--   menu_positions       — Zuordnung Menü ↔ Position (n-zu-m, sortiert, Preis-Override)
--   position_components  — Bestandteile einer Position (= menu_item_components, an Position)
-- Daten werden 1:1 aus menu_items / menu_item_components übernommen (eine Position
-- je bestehender menu_items-Zeile). Dubletten-Zusammenführung erfolgt später manuell.
-- menu_items / menu_item_components bleiben vorerst als Legacy erhalten (Fallback).
-- Siehe OSD_CATERING_PLATFORM_POSITIONEN_SPEC.md.
--
-- Additiv & idempotent: gefahrlos auf der befüllten Live-DB ausführbar.
-- ============================================================

-- ── positions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.positions (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code TEXT,
  name          TEXT          NOT NULL,
  description   TEXT,
  dietary       TEXT,
  allergens     TEXT[]        NOT NULL DEFAULT '{}',
  default_price NUMERIC(10,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.positions IS 'Wiederverwendbare Menü-Positionen (Katalog); zentral pflegbar, geteilt über Menüs.';
CREATE UNIQUE INDEX IF NOT EXISTS positions_position_code_key ON public.positions (position_code) WHERE position_code IS NOT NULL;

DROP TRIGGER IF EXISTS positions_updated_at ON public.positions;
CREATE TRIGGER positions_updated_at BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── menu_positions (Zuordnung) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_positions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id        UUID         NOT NULL REFERENCES public.menus (id)     ON DELETE CASCADE,
  position_id    UUID         NOT NULL REFERENCES public.positions (id) ON DELETE RESTRICT,
  sort_order     INTEGER      NOT NULL DEFAULT 0,
  price_override NUMERIC(10,2),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT menu_positions_menu_position_key UNIQUE (menu_id, position_id)
);
COMMENT ON TABLE public.menu_positions IS 'Zuordnung Menü ↔ Position mit Reihenfolge und optionalem Menü-Preis.';
CREATE INDEX IF NOT EXISTS idx_menu_positions_menu     ON public.menu_positions (menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_positions_position ON public.menu_positions (position_id);

-- ── position_components (Bestandteile) ───────────────────────
CREATE TABLE IF NOT EXISTS public.position_components (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id   UUID          NOT NULL REFERENCES public.positions (id)   ON DELETE CASCADE,
  recipe_id     UUID          REFERENCES public.recipes (id)     ON DELETE CASCADE,
  ingredient_id UUID          REFERENCES public.ingredients (id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_id       UUID          REFERENCES public.units (id)       ON DELETE SET NULL,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pc_exactly_one_target CHECK (
    (recipe_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int = 1
  )
);
COMMENT ON TABLE public.position_components IS 'Bestandteile einer Position: je Zeile ein (vorproduziertes) Rezept oder eine zugekaufte/rohe Zutat, Menge pro Portion. unit_id NULL bei Rezept = Portionen.';
CREATE INDEX IF NOT EXISTS idx_pc_position   ON public.position_components (position_id);
CREATE INDEX IF NOT EXISTS idx_pc_recipe     ON public.position_components (recipe_id);
CREATE INDEX IF NOT EXISTS idx_pc_ingredient ON public.position_components (ingredient_id);

-- ── RLS (Muster wie operative Tabellen) ──────────────────────
ALTER TABLE public.positions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_positions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_components  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['positions','menu_positions','position_components'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='authenticated_all_'||t) THEN
      EXECUTE format('CREATE POLICY "authenticated_all_%1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='anon_all_'||t) THEN
      EXECUTE format('CREATE POLICY "anon_all_%1$s" ON public.%1$I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

-- ── Daten-Migration (1:1 aus menu_items), idempotent über position_code = 'MI-'||menu_item.id
-- 1) eine Position je menu_items-Zeile
INSERT INTO public.positions (position_code, name, description, dietary, allergens, default_price)
SELECT 'MI-' || mi.id::text, mi.name, mi.description, mi.dietary, COALESCE(mi.allergens, '{}'::text[]), mi.item_price
FROM   public.menu_items mi
WHERE  NOT EXISTS (SELECT 1 FROM public.positions p WHERE p.position_code = 'MI-' || mi.id::text);

-- 2) Menü ↔ Position
INSERT INTO public.menu_positions (menu_id, position_id, sort_order, price_override)
SELECT mi.menu_id, p.id, COALESCE(mi.sort_order, 0), mi.item_price
FROM   public.menu_items mi
JOIN   public.positions p ON p.position_code = 'MI-' || mi.id::text
WHERE  NOT EXISTS (
  SELECT 1 FROM public.menu_positions mp WHERE mp.menu_id = mi.menu_id AND mp.position_id = p.id
);

-- 3) Komponenten umhängen (aus menu_item_components)
INSERT INTO public.position_components (position_id, recipe_id, ingredient_id, quantity, unit_id, sort_order)
SELECT p.id, c.recipe_id, c.ingredient_id, c.quantity, c.unit_id, COALESCE(c.sort_order, 0)
FROM   public.menu_item_components c
JOIN   public.positions p ON p.position_code = 'MI-' || c.menu_item_id::text
WHERE  NOT EXISTS (
  SELECT 1 FROM public.position_components pc
  WHERE pc.position_id = p.id
    AND pc.recipe_id     IS NOT DISTINCT FROM c.recipe_id
    AND pc.ingredient_id IS NOT DISTINCT FROM c.ingredient_id
);

-- 4) Fallback: menu_items mit recipe_id, aber ohne Komponente → 1-Portion-Rezept-Komponente
INSERT INTO public.position_components (position_id, recipe_id, quantity, unit_id, sort_order)
SELECT p.id, mi.recipe_id, 1, NULL, 0
FROM   public.menu_items mi
JOIN   public.positions p ON p.position_code = 'MI-' || mi.id::text
WHERE  mi.recipe_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM public.position_components pc WHERE pc.position_id = p.id);

NOTIFY pgrst, 'reload schema';
