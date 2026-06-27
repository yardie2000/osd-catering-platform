-- ============================================================
-- OSD Catering — Teil 1: TROCKENLAUF-REPORT (nur SELECT, ändert nichts)
-- Begleitet: supabase/migrations/20260627000001_reclassify_pdf_recipe_ingredients.sql
--
-- Im Supabase SQL-Editor ausführen, BEVOR die Konvertierungs-Migration läuft,
-- um zu sehen, welche Rezepte als Zutaten erkannt werden — und welche bewusst
-- Rezept bleiben. Reine Lese-Abfrage, keine Schreibvorgänge.
-- ============================================================

-- A) Werden zu Zutaten konvertiert (Heuristik trifft zu):
SELECT
  'WIRD ZUTAT' AS klassifikation,
  r.recipe_code,
  r.name,
  'ZUT-' || replace(r.recipe_code, 'PDF-STUB-', '')                         AS neuer_zutat_code,
  (SELECT count(*) FROM public.position_components pc WHERE pc.recipe_id = r.id) AS referenzen_in_positionen
FROM public.recipes r
WHERE r.recipe_status <> 'archived'
  AND COALESCE(r.production_notes, '') NOT LIKE 'KONVERTIERT-ZU-ZUTAT%'
  AND (r.needs_review = true OR r.recipe_status = 'incomplete' OR r.recipe_code LIKE 'PDF-STUB-%')
  AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id)
  AND r.yield_quantity IS NULL
  AND COALESCE(r.preparation, '') = ''
  AND r.name NOT LIKE '%|%'
  AND r.name !~* '(Sauce|Jus|Dressing|Püree|Puree|Pesto|Aioli|Mayonnaise|Fond|Beurre|Vinaigrette|Gremolata|Marinade|Quark|Sugo|Chutney|Relish|Kompott|Confit|Suppe|Salat oder)'

UNION ALL

-- B) Bleiben bewusst Rezept (Import/Review-Stub, aber Zubereitung oder
--    zusammengesetztes Gericht — z. B. Jus, Teriyaki Sauce, Ceviche | …):
SELECT
  'BLEIBT REZEPT' AS klassifikation,
  r.recipe_code,
  r.name,
  NULL AS neuer_zutat_code,
  (SELECT count(*) FROM public.position_components pc WHERE pc.recipe_id = r.id) AS referenzen_in_positionen
FROM public.recipes r
WHERE r.recipe_status <> 'archived'
  AND (r.needs_review = true OR r.recipe_status = 'incomplete' OR r.recipe_code LIKE 'PDF-STUB-%')
  AND NOT (
        NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id)
    AND r.yield_quantity IS NULL
    AND COALESCE(r.preparation, '') = ''
    AND r.name NOT LIKE '%|%'
    AND r.name !~* '(Sauce|Jus|Dressing|Püree|Puree|Pesto|Aioli|Mayonnaise|Fond|Beurre|Vinaigrette|Gremolata|Marinade|Quark|Sugo|Chutney|Relish|Kompott|Confit|Suppe|Salat oder)'
  )
ORDER BY klassifikation, recipe_code;

-- C) Nachher-Kontrolle (nach der Migration ausführen): konvertierte Datensätze.
-- SELECT recipe_code, name, recipe_status, production_notes
-- FROM public.recipes
-- WHERE production_notes LIKE 'KONVERTIERT-ZU-ZUTAT:%'
-- ORDER BY recipe_code;
