-- ============================================================
-- OSD Catering — Teil 1: Folge-Schritt — archivierte Stub-Rezepte HART löschen
-- Begleitet: supabase/migrations/20260627000001_reclassify_pdf_recipe_ingredients.sql
--
-- ⚠ DESTRUKTIV. Erst ausführen, NACHDEM die Konvertierung in der App geprüft wurde
--    (Report A/C aus 20260627000001_report_reclassify_candidates.sql) und ein
--    DB-Backup vorliegt. Manuell im Supabase SQL-Editor ausführen — NICHT Teil der
--    automatischen Migrationskette.
--
-- Löscht ausschließlich Rezepte, die
--   • durch die Konvertierung archiviert + markiert wurden ('KONVERTIERT-ZU-ZUTAT:'),
--   • UND nirgends mehr referenziert sind (keine position_components, keine
--     menu_recipes, keine recipe_ingredients).
-- Bleibt eine Referenz bestehen, wird der Datensatz NICHT gelöscht (kein stiller
-- Datenverlust) — dann zuerst die Referenz prüfen/umhängen.
-- ============================================================

-- Vorschau: was würde gelöscht?
SELECT r.recipe_code, r.name, r.production_notes
FROM public.recipes r
WHERE r.recipe_status = 'archived'
  AND r.production_notes LIKE 'KONVERTIERT-ZU-ZUTAT:%'
  AND NOT EXISTS (SELECT 1 FROM public.position_components pc WHERE pc.recipe_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM public.menu_recipes mr        WHERE mr.recipe_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri  WHERE ri.recipe_id = r.id)
ORDER BY r.recipe_code;

-- Löschung (nach Prüfung der Vorschau die folgende Anweisung ausführen):
DELETE FROM public.recipes r
WHERE r.recipe_status = 'archived'
  AND r.production_notes LIKE 'KONVERTIERT-ZU-ZUTAT:%'
  AND NOT EXISTS (SELECT 1 FROM public.position_components pc WHERE pc.recipe_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM public.menu_recipes mr        WHERE mr.recipe_id = r.id)
  AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri  WHERE ri.recipe_id = r.id);

NOTIFY pgrst, 'reload schema';
