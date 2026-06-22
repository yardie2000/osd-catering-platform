-- ============================================================
-- OSD Catering — Phase 5 Cutover: Legacy-Tabellen entfernen
-- Migration: 20260617000000_drop_legacy_menu_items
--
-- Entfernt die Alt-Tabellen menu_items / menu_item_components. Der geteilte
-- Positions-Katalog (positions / menu_positions / position_components, Phase 1)
-- ist seit dem V5-Cutover die einzige Quelle; kein App-Code referenziert die
-- Alt-Tabellen mehr (Engine, Services, Importer umgestellt). Die Daten wurden
-- in Phase 1 1:1 nach positions/menu_positions/position_components migriert.
--
-- ⚠ DESTRUKTIV & IRREVERSIBEL. Vor dem Ausführen ein DB-Backup anlegen.
--    Im Supabase SQL-Editor ausführen.
-- ============================================================

-- ── Sicherung: Cutover abbrechen, falls ein Menü noch ohne menu_positions ist
--    (würde sich sonst auf den entfallenden menu_items-Fallback verlassen).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM public.menus m
  WHERE NOT EXISTS (SELECT 1 FROM public.menu_positions mp WHERE mp.menu_id = m.id);
  IF n > 0 THEN
    RAISE EXCEPTION 'Cutover abgebrochen: % Menue(s) ohne menu_positions — erst auf den Positions-Katalog umstellen.', n;
  END IF;
END $$;

-- ── Drop (menu_item_components zuerst: FK auf menu_items) ─────
DROP TABLE IF EXISTS public.menu_item_components CASCADE;
DROP TABLE IF EXISTS public.menu_items          CASCADE;

NOTIFY pgrst, 'reload schema';
