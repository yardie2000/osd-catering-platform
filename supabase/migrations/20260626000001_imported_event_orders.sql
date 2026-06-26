-- ============================================================
-- OSD Catering - MouseClick Produktbedarf Import Review
-- Migration: 20260626000001_imported_event_orders
--
-- Additive review schema for MouseClick CSV imports. The catalog tables
-- (menus, positions, recipes, ingredients) remain master data and are not
-- changed by this import.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.imported_events (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id          UUID        REFERENCES public.import_jobs (id) ON DELETE SET NULL,
  event_name             TEXT        NOT NULL,
  normalized_event_name  TEXT        NOT NULL,
  pax_count              NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                 TEXT        NOT NULL DEFAULT 'needs_review'
                                      CHECK (status IN ('matched','needs_review','reviewed','calculated','failed')),
  warnings               TEXT[]      NOT NULL DEFAULT '{}',
  source_filename        TEXT,
  imported_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.imported_events IS
  'Events reconstructed from MouseClick Produktbedarf CSV rows; one event can contain multiple sold menu orders.';

DROP TRIGGER IF EXISTS imported_events_updated_at ON public.imported_events;
CREATE TRIGGER imported_events_updated_at
  BEFORE UPDATE ON public.imported_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_imported_events_job ON public.imported_events (import_job_id);
CREATE INDEX IF NOT EXISTS idx_imported_events_normalized_name ON public.imported_events (normalized_event_name);
CREATE INDEX IF NOT EXISTS idx_imported_events_status ON public.imported_events (status);

CREATE TABLE IF NOT EXISTS public.imported_event_orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_event_id      UUID        NOT NULL REFERENCES public.imported_events (id) ON DELETE CASCADE,
  import_job_id          UUID        REFERENCES public.import_jobs (id) ON DELETE SET NULL,
  source_row_number      INTEGER     NOT NULL,
  product_name           TEXT        NOT NULL,
  long_description       TEXT        NOT NULL DEFAULT '',
  total_quantity         NUMERIC(12,2) NOT NULL DEFAULT 0,
  event_pax              NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit                   TEXT        NOT NULL DEFAULT '',
  category               TEXT        NOT NULL DEFAULT '',
  raw_orders             TEXT        NOT NULL DEFAULT '',
  raw_event_order        TEXT        NOT NULL DEFAULT '',
  matched_menu_id        UUID        REFERENCES public.menus (id) ON DELETE SET NULL,
  matched_menu_name      TEXT,
  menu_confidence        NUMERIC(5,4) NOT NULL DEFAULT 0,
  menu_match_strategy    TEXT        NOT NULL DEFAULT 'no-match',
  expected_item_count    INTEGER,
  status                 TEXT        NOT NULL DEFAULT 'needs_review'
                                      CHECK (status IN ('matched','needs_review','reviewed','calculated','failed')),
  needs_review           BOOLEAN     NOT NULL DEFAULT true,
  warnings               TEXT[]      NOT NULL DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.imported_event_orders IS
  'One sold menu/order line per imported event, reconstructed from MouseClick Produktbedarf CSV rows.';

DROP TRIGGER IF EXISTS imported_event_orders_updated_at ON public.imported_event_orders;
CREATE TRIGGER imported_event_orders_updated_at
  BEFORE UPDATE ON public.imported_event_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_imported_event_orders_event ON public.imported_event_orders (imported_event_id);
CREATE INDEX IF NOT EXISTS idx_imported_event_orders_job ON public.imported_event_orders (import_job_id);
CREATE INDEX IF NOT EXISTS idx_imported_event_orders_menu ON public.imported_event_orders (matched_menu_id);
CREATE INDEX IF NOT EXISTS idx_imported_event_orders_status ON public.imported_event_orders (status);

CREATE TABLE IF NOT EXISTS public.imported_event_selected_items (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_event_order_id   UUID        NOT NULL REFERENCES public.imported_event_orders (id) ON DELETE CASCADE,
  sort_order               INTEGER     NOT NULL DEFAULT 0,
  raw_position_text         TEXT        NOT NULL DEFAULT '',
  matched_menu_item_id      UUID        REFERENCES public.positions (id) ON DELETE SET NULL,
  matched_recipe_id         UUID        REFERENCES public.recipes (id) ON DELETE SET NULL,
  confidence                NUMERIC(5,4) NOT NULL DEFAULT 0,
  needs_review              BOOLEAN     NOT NULL DEFAULT true,
  original_text             TEXT        NOT NULL DEFAULT '',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.imported_event_selected_items IS
  'Only positions selected by the customer for one imported order. This table must never be auto-filled from all menu positions.';

DROP TRIGGER IF EXISTS imported_event_selected_items_updated_at ON public.imported_event_selected_items;
CREATE TRIGGER imported_event_selected_items_updated_at
  BEFORE UPDATE ON public.imported_event_selected_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_imported_selected_items_order ON public.imported_event_selected_items (imported_event_order_id);
CREATE INDEX IF NOT EXISTS idx_imported_selected_items_position ON public.imported_event_selected_items (matched_menu_item_id);
CREATE INDEX IF NOT EXISTS idx_imported_selected_items_recipe ON public.imported_event_selected_items (matched_recipe_id);
CREATE INDEX IF NOT EXISTS idx_imported_selected_items_review ON public.imported_event_selected_items (needs_review);

ALTER TABLE public.imported_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_event_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_event_selected_items ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['imported_events','imported_event_orders','imported_event_selected_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'authenticated_all_' || t
    ) THEN
      EXECUTE format('CREATE POLICY "authenticated_all_%1$s" ON public.%1$I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'anon_all_' || t
    ) THEN
      EXECUTE format('CREATE POLICY "anon_all_%1$s" ON public.%1$I FOR ALL TO anon USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
