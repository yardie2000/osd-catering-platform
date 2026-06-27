-- ============================================================
-- OSD Catering — Teil 1: Falsch importierte "Rezepte" → Zutaten
-- Migration: 20260627000001_reclassify_pdf_recipe_ingredients
--
-- Problem: Der PDF-Katalog-Import (20260626000003) hat reine Zutaten als
-- Rezept-Stubs angelegt (PDF-STUB-BURRATA, -PARMESAN, -ROMANA, -FRUEHLINGSZWIEBEL,
-- -POULARDE, -KABELJAU, -GEGRILLTES-HAEHNCHEN …). Fachlich sind das KEINE Rezepte
-- (keine Zutatenliste, kein Yield, kein Produktionsschritt, keine Portionsbasis),
-- sondern zugekaufte/rohe Zutaten. Sie verfälschen die Vorproduktions-Aggregation.
--
-- Lösung (REVERSIBEL & ADDITIV):
--   1. Für jeden fälschlich als Rezept geführten Datensatz eine echte Zutat anlegen.
--   2. Alle position_components-Referenzen vom Rezept auf die neue Zutat umhängen
--      (recipe_id → NULL, ingredient_id → neue Zutat) — bestehende Verknüpfungen
--      bleiben fachlich erhalten, nur der Typ wechselt Rezept → Zutat.
--   3. Das alte Rezept NICHT löschen, sondern auf recipe_status='archived' setzen
--      und mit Marker 'KONVERTIERT-ZU-ZUTAT:' versehen. → Jederzeit zurückrollbar.
--
-- Die endgültige harte Löschung der archivierten Stubs erfolgt erst NACH Prüfung
-- über die separate, manuell auszuführende Folge-Migration:
--   supabase/manual/20260627000002_drop_converted_recipe_stubs.sql
--
-- HEURISTIK "Rezept ist in Wahrheit eine Zutat" — ein Datensatz wird konvertiert,
-- wenn ALLE Bedingungen zutreffen:
--   • stammt aus Import/Review (needs_review, recipe_status='incomplete'
--     oder recipe_code beginnt mit 'PDF-STUB-') — handgepflegte aktive Rezepte
--     bleiben unangetastet,
--   • besitzt KEINE Rezeptzutaten (recipe_ingredients = 0),
--   • besitzt KEIN Yield (yield_quantity IS NULL),
--   • besitzt KEINEN Produktionsschritt (preparation leer),
--   • Name ist KEIN zusammengesetztes Gericht (kein '|'-Trenner),
--   • Name ist KEINE Eigenproduktion/Zubereitung
--     (Sauce, Jus, Dressing, Püree, Pesto, Aioli, Mayonnaise, Fond, Beurre,
--      Vinaigrette, Gremolata, Marinade, Quark, Sugo, Chutney, Relish, Kompott,
--      Confit, Suppe, "Salat oder …" → bleiben Rezepte/Vorproduktion).
--
-- Idempotent: bereits archivierte/konvertierte Datensätze werden übersprungen.
-- Additiv: legt nur an, hängt um, archiviert — löscht nichts.
-- ============================================================

-- ── 1) Echte Zutaten aus den Stub-Rezepten anlegen ───────────
WITH candidates AS (
  SELECT
    r.id,
    r.recipe_code,
    'ZUT-' || replace(r.recipe_code, 'PDF-STUB-', '')                       AS ing_code,
    btrim(regexp_replace(r.name, '\s*\(PDF-Komponente\)\s*$', ''))          AS ing_name
  FROM public.recipes r
  WHERE r.recipe_status <> 'archived'
    AND COALESCE(r.production_notes, '') NOT LIKE 'KONVERTIERT-ZU-ZUTAT%'
    AND (r.needs_review = true OR r.recipe_status = 'incomplete' OR r.recipe_code LIKE 'PDF-STUB-%')
    AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id)
    AND r.yield_quantity IS NULL
    AND COALESCE(r.preparation, '') = ''
    AND r.name NOT LIKE '%|%'
    AND r.name !~* '(Sauce|Jus|Dressing|Püree|Puree|Pesto|Aioli|Mayonnaise|Fond|Beurre|Vinaigrette|Gremolata|Marinade|Quark|Sugo|Chutney|Relish|Kompott|Confit|Suppe|Salat oder)'
)
INSERT INTO public.ingredients (ingredient_code, name, category, notes)
SELECT
  c.ing_code,
  c.ing_name,
  'PDF-Import (auto)',
  'Automatisch aus Rezept ' || c.recipe_code
    || ' umgewandelt (PDF-Reklassifizierung 2026-06-27). Kategorie/Einheit/Allergene fachlich prüfen.'
FROM candidates c
WHERE NOT EXISTS (
  SELECT 1 FROM public.ingredients i WHERE i.ingredient_code = c.ing_code
);

-- ── 2) position_components umhängen: Rezept → neue Zutat ──────
--    Erfüllt die CHECK-Constraint (genau eines von recipe_id/ingredient_id),
--    weil recipe_id und ingredient_id in einer UPDATE-Anweisung gesetzt werden.
WITH candidates AS (
  SELECT
    r.id,
    'ZUT-' || replace(r.recipe_code, 'PDF-STUB-', '') AS ing_code
  FROM public.recipes r
  WHERE r.recipe_status <> 'archived'
    AND COALESCE(r.production_notes, '') NOT LIKE 'KONVERTIERT-ZU-ZUTAT%'
    AND (r.needs_review = true OR r.recipe_status = 'incomplete' OR r.recipe_code LIKE 'PDF-STUB-%')
    AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id)
    AND r.yield_quantity IS NULL
    AND COALESCE(r.preparation, '') = ''
    AND r.name NOT LIKE '%|%'
    AND r.name !~* '(Sauce|Jus|Dressing|Püree|Puree|Pesto|Aioli|Mayonnaise|Fond|Beurre|Vinaigrette|Gremolata|Marinade|Quark|Sugo|Chutney|Relish|Kompott|Confit|Suppe|Salat oder)'
)
UPDATE public.position_components pc
SET recipe_id     = NULL,
    ingredient_id = i.id
FROM candidates c
JOIN public.ingredients i ON i.ingredient_code = c.ing_code
WHERE pc.recipe_id = c.id;

-- ── 3) Stub-Rezepte archivieren (nicht löschen) + Marker ─────
WITH candidates AS (
  SELECT
    r.id,
    'ZUT-' || replace(r.recipe_code, 'PDF-STUB-', '') AS ing_code
  FROM public.recipes r
  WHERE r.recipe_status <> 'archived'
    AND COALESCE(r.production_notes, '') NOT LIKE 'KONVERTIERT-ZU-ZUTAT%'
    AND (r.needs_review = true OR r.recipe_status = 'incomplete' OR r.recipe_code LIKE 'PDF-STUB-%')
    AND NOT EXISTS (SELECT 1 FROM public.recipe_ingredients ri WHERE ri.recipe_id = r.id)
    AND r.yield_quantity IS NULL
    AND COALESCE(r.preparation, '') = ''
    AND r.name NOT LIKE '%|%'
    AND r.name !~* '(Sauce|Jus|Dressing|Püree|Puree|Pesto|Aioli|Mayonnaise|Fond|Beurre|Vinaigrette|Gremolata|Marinade|Quark|Sugo|Chutney|Relish|Kompott|Confit|Suppe|Salat oder)'
)
UPDATE public.recipes r
SET recipe_status    = 'archived',
    needs_review     = false,
    production_notes  = 'KONVERTIERT-ZU-ZUTAT: ' || c.ing_code
                        || ' | ' || COALESCE(r.production_notes, '')
FROM candidates c
WHERE r.id = c.id;

NOTIFY pgrst, 'reload schema';
