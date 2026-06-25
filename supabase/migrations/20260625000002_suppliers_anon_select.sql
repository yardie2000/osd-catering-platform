-- ============================================================
-- OSD Catering — anon-SELECT für suppliers
-- Migration: 20260625000002_suppliers_anon_select
--
-- Die App läuft öffentlich als Rolle `anon`. V2 hat für `suppliers`
-- nur `authenticated_all_suppliers` angelegt, aber KEINE anon-Policy.
-- Dadurch liefert der eingebettete Lieferantenname (supplier_articles ->
-- suppliers) in der Zutaten-UI null. Diese Policy schließt die Lücke.
--
-- Idempotent. Nur Lesezugriff für anon; Schreibrechte bleiben bei
-- authenticated (bzw. Service-Role für Importe).
-- ============================================================

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_select_suppliers ON public.suppliers;
CREATE POLICY anon_select_suppliers
  ON public.suppliers FOR SELECT TO anon USING (true);

NOTIFY pgrst, 'reload schema';
