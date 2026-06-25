-- ============================================================
-- OSD Catering — anon-Schreibrechte für suppliers
-- Migration: 20260625000003_suppliers_anon_write
--
-- Damit neue Lieferanten direkt aus der UI angelegt werden können
-- (öffentliche No-Auth-App, Rolle anon). Konsistent mit den anon-Write-
-- Policies auf ingredients / supplier_articles / ingredient_supplier_articles.
--
-- Idempotent.
-- ⚠️ SICHERHEIT: erlaubt jedem mit Projekt-URL, Lieferanten zu schreiben –
--   passend für ein internes Tool; für echte öffentliche Auth absichern.
-- ============================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_write_suppliers ON public.suppliers;
CREATE POLICY anon_write_suppliers
  ON public.suppliers FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
