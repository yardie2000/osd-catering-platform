-- ============================================================
-- OSD Catering — Menü-Positions-Komponenten (Stücklisten-Modell)
-- Migration: 20260616000000_menu_item_components
--
-- Eine Menü-Position (menu_items) kann aus mehreren Komponenten bestehen:
--   - recipe_id     → ein (vorproduziertes) Rezept   (z. B. 1 Portion Sauce)
--   - ingredient_id → eine zugekaufte/rohe Zutat      (z. B. 1 Stk Poularde)
-- Fachlicher Nachfolger von menu_items.recipe_id (bleibt vorerst als Legacy-
-- Spalte erhalten; Quelle der Wahrheit sind ab Phase 2 die Komponenten).
-- Siehe OSD_CATERING_PLATFORM_KOMPONENTEN_SPEC.md.
--
-- Additiv & idempotent: gefahrlos auf der befüllten Live-DB ausführbar.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menu_item_components (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id  UUID          NOT NULL REFERENCES public.menu_items (id) ON DELETE CASCADE,
  recipe_id     UUID          REFERENCES public.recipes (id)     ON DELETE CASCADE,
  ingredient_id UUID          REFERENCES public.ingredients (id) ON DELETE RESTRICT,
  quantity      NUMERIC(12,4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_id       UUID          REFERENCES public.units (id)       ON DELETE SET NULL,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Genau eines von recipe_id / ingredient_id muss gesetzt sein.
  CONSTRAINT mic_exactly_one_target CHECK (
    (recipe_id IS NOT NULL)::int + (ingredient_id IS NOT NULL)::int = 1
  )
);

COMMENT ON TABLE public.menu_item_components IS
  'Bestandteile einer Menü-Position: je Zeile entweder ein (vorproduziertes) Rezept oder eine zugekaufte/rohe Zutat, mit Menge pro Portion. unit_id NULL bei Rezept-Komponente = Portionen.';

CREATE INDEX IF NOT EXISTS idx_mic_menu_item  ON public.menu_item_components (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_mic_recipe     ON public.menu_item_components (recipe_id);
CREATE INDEX IF NOT EXISTS idx_mic_ingredient ON public.menu_item_components (ingredient_id);

-- ── Row Level Security (Muster wie operative Tabellen) ───────
ALTER TABLE public.menu_item_components ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='menu_item_components'
                 AND policyname='authenticated_all_menu_item_components') THEN
    CREATE POLICY "authenticated_all_menu_item_components"
      ON public.menu_item_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='menu_item_components'
                 AND policyname='anon_all_menu_item_components') THEN
    CREATE POLICY "anon_all_menu_item_components"
      ON public.menu_item_components FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── Einmal-Backfill: bestehende Einzel-Verknüpfungen → je 1 Rezept-Komponente
--    (1 Portion). Idempotent (NOT EXISTS). Auf leerer menu_items ein No-op
--    (z. B. bei Schema-Neuaufbau vor dem Daten-Import).
INSERT INTO public.menu_item_components (menu_item_id, recipe_id, quantity, unit_id, sort_order)
SELECT mi.id, mi.recipe_id, 1, NULL, COALESCE(mi.sort_order, 0)
FROM   public.menu_items mi
WHERE  mi.recipe_id IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM public.menu_item_components c
    WHERE c.menu_item_id = mi.id AND c.recipe_id = mi.recipe_id
  );

NOTIFY pgrst, 'reload schema';
