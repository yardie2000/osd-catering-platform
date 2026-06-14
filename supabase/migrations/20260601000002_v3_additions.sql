-- ============================================================
-- OSD Catering Platform V2 → V3 additions
-- Migration: 20260601000002_v3_additions
-- ============================================================

-- ── menus: new columns ───────────────────────────────────────

ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS price_per_person NUMERIC(10,2);
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS service_note     TEXT;

-- ── supplier_products ────────────────────────────────────────
-- Packaging and pricing data per ingredient-supplier combination.
-- Linked to ingredients (not the future suppliers stub) so it can
-- be used immediately without a separate supplier import flow.

CREATE TABLE IF NOT EXISTS public.supplier_products (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id           UUID          NOT NULL REFERENCES public.ingredients (id) ON DELETE CASCADE,
  supplier_name           TEXT          NOT NULL,
  supplier_article_number TEXT,
  package_quantity        NUMERIC(12,4),
  package_unit            TEXT,
  package_description     TEXT,
  minimum_order_quantity  NUMERIC(12,4),
  lead_time_days          INTEGER,
  supplier_sku            TEXT,
  supplier_pack_price     NUMERIC(12,4),
  active                  BOOLEAN       NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT supplier_products_ingredient_supplier_key UNIQUE (ingredient_id, supplier_name)
);

COMMENT ON TABLE public.supplier_products IS 'Supplier packaging and pricing per ingredient; package_quantity/unit/description describe the commercial unit (e.g. 24 Stück per Karton).';

CREATE TRIGGER supplier_products_updated_at
  BEFORE UPDATE ON public.supplier_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_supplier_products_ingredient ON public.supplier_products (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier   ON public.supplier_products (supplier_name);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_supplier_products" ON public.supplier_products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_select_supplier_products"        ON public.supplier_products FOR SELECT TO anon   USING (true);
