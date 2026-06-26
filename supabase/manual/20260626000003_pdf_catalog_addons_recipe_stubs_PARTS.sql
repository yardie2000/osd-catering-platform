-- ============================================================
-- Manual Supabase SQL Editor version
-- Run each numbered block separately and completely.
--
-- If Supabase shows "syntax error at end of input", the usual cause is that
-- only part of a DO $$ ... $$ block was selected/pasted. This file keeps the
-- two DO blocks isolated.
-- ============================================================

-- 01_import_review_columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'imported_event_orders'
      AND column_name = 'variant_item_count'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'imported_event_orders'
      AND column_name = 'expected_item_count'
  ) THEN
    ALTER TABLE public.imported_event_orders
      RENAME COLUMN variant_item_count TO expected_item_count;
  END IF;
END $$;

ALTER TABLE public.imported_event_orders
  ADD COLUMN IF NOT EXISTS expected_item_count INTEGER;

ALTER TABLE public.imported_event_orders
  DROP COLUMN IF EXISTS variant_label,
  DROP COLUMN IF EXISTS variant_confidence;

COMMENT ON COLUMN public.imported_event_orders.expected_item_count IS
  'Expected number of selected positions derived from the original product text (e.g. 6 Teile). Not a separate fachliche variant.';

-- 02_addon_flags
ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS is_add_on BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.menu_positions
  ADD COLUMN IF NOT EXISTS is_add_on BOOLEAN NOT NULL DEFAULT false;

WITH addon_rows(menu_code, position_name) AS (
  VALUES
    ('MENU_ABENDMENU_2026', 'Süßkartoffelspalten | Aioli | Parmesan | Frühlingzwiebel'),
    ('MENU_ABENDMENU_2026', 'Tomatensalat | Burrata'),
    ('MENU_ABENDMENU_2026', 'Bunte Bete Salat | Burrata (Winter)'),
    ('MENU_ABENDMENU_2026', 'Rumpsteak | Jus'),
    ('MENU_BBQ_2026', 'Süßkartoffelspalten | Aioli | Parmesan | Frühlingzwiebel'),
    ('MENU_BBQ_2026', 'Tomatensalat | Burrata'),
    ('MENU_BBQ_2026', 'Hausgemachtes Seitan Steak | Pak Choi | Sesam'),
    ('MENU_BBQ_2026', 'Brisket | Kimchi'),
    ('MENU_SOMMER_2026', 'Austern & Crémant (3 Stück + 1 Glas Crémant)'),
    ('MENU_SOMMER_2026', 'Steak Tartar | Brioche & Porn Star Martini')
)
UPDATE public.menu_positions mp
SET is_add_on = true
FROM public.menus m, public.positions p, addon_rows a
WHERE mp.menu_id = m.id
  AND mp.position_id = p.id
  AND m.menu_code = a.menu_code
  AND p.name = a.position_name;

UPDATE public.positions p
SET is_add_on = true
WHERE EXISTS (
  SELECT 1
  FROM public.menu_positions mp
  WHERE mp.position_id = p.id
    AND mp.is_add_on = true
);

-- 03_recipe_review_columns
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipe_status TEXT NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recipes_recipe_status_chk'
  ) THEN
    ALTER TABLE public.recipes
      ADD CONSTRAINT recipes_recipe_status_chk
      CHECK (recipe_status IN ('active', 'incomplete', 'archived'));
  END IF;
END $$;

-- 04_recipe_stubs
WITH stubs(recipe_code, name, usage_notes, production_notes) AS (
  VALUES
    ('PDF-STUB-BURRATA', 'Burrata (PDF-Komponente)', 'PDF-Katalog 2026: Burrata-Komponente fuer Tomaten-/Bete-Add-ons.', 'Unvollstaendiger Rezept-Stub: Zutatenmengen fachlich pruefen.'),
    ('PDF-STUB-SUESSKARTOFFEL', 'Süßkartoffelspalten (PDF-Komponente)', 'PDF-Katalog 2026: Süßkartoffelspalten fuer Add-on.', 'Unvollstaendiger Rezept-Stub: Schnitt, Garverlust und Portionsmenge pruefen.'),
    ('PDF-STUB-PARMESAN', 'Parmesan (PDF-Komponente)', 'PDF-Katalog 2026: Parmesan als Positionsbestandteil.', 'Unvollstaendiger Rezept-Stub: Portionsmenge pruefen.'),
    ('PDF-STUB-FRUEHLINGSZWIEBEL', 'Frühlingszwiebel (PDF-Komponente)', 'PDF-Katalog 2026: Frühlingszwiebel als Positionsbestandteil.', 'Unvollstaendiger Rezept-Stub: Portionsmenge pruefen.'),
    ('PDF-STUB-ROMANA', 'Romana Salatherzen (PDF-Komponente)', 'PDF-Katalog 2026: Caesar Salad Bestandteil.', 'Unvollstaendiger Rezept-Stub: Putzverlust und Portionsmenge pruefen.'),
    ('PDF-STUB-TERIYAKI', 'Teriyaki Sauce (PDF-Komponente)', 'PDF-Katalog 2026: Caesar Salad Bestandteil.', 'Unvollstaendiger Rezept-Stub: Rezeptur/Menge pruefen.'),
    ('PDF-STUB-CAESAR-CHICKEN', 'Hähnchen fuer Caesar Salad (PDF-Komponente)', 'PDF-Katalog 2026: Caesar Salad mit Hähnchen.', 'Unvollstaendiger Rezept-Stub: Garmethode und Portionsmenge pruefen.'),
    ('PDF-STUB-OFENGEMUESE-LABNEH', 'Ofengemüse der Saison | Labneh | Zaatar', 'PDF-Katalog 2026: Abendmenü-Position.', 'Unvollstaendiger Rezept-Stub: Komponenten/Mengen pruefen.'),
    ('PDF-STUB-BUNTES-GEMUESE', 'Buntes Gemüse', 'PDF-Katalog 2026: BBQ-Position.', 'Unvollstaendiger Rezept-Stub: Gemuesemix/Mengen pruefen.'),
    ('PDF-STUB-SEITAN-PAKCHOI-SESAM', 'Hausgemachtes Seitan Steak | Pak Choi | Sesam', 'PDF-Katalog 2026: BBQ/Sommermenü-Position.', 'Unvollstaendiger Rezept-Stub: Seitan, Pak Choi, Sesam und Mengen pruefen.'),
    ('PDF-STUB-PIMIENTO-HARISSA', 'Pimiento del Padrón | Harissa | Meersalz', 'PDF-Katalog 2026: Sommermenü-Position.', 'Unvollstaendiger Rezept-Stub: Portionsmenge pruefen.'),
    ('PDF-STUB-PIMIENTOS-WASABI', 'Pimientos del Padron | Sesam | Wasabi-Mayonnaise', 'PDF-Katalog 2026: Hochzeitsmenü-Position.', 'Unvollstaendiger Rezept-Stub: Wasabi-Mayonnaise und Mengen pruefen.'),
    ('PDF-STUB-CEVICHE', 'Ceviche | Fisch des Tages | Habanero Tigermilch | Avocado | Süßkartoffelchips', 'PDF-Katalog 2026: Hochzeitsmenü-Position.', 'Unvollstaendiger Rezept-Stub: Fisch, Tigermilch, Avocado und Chips pruefen.'),
    ('PDF-STUB-ROASTBEEF-SENFSAUCE', 'Langsam gegartes Roastbeef | gebrannte Senfsauce | grüner Apfel | Zitrone', 'PDF-Katalog 2026: Hochzeitsmenü-Position.', 'Unvollstaendiger Rezept-Stub: Garverlust und Saucenmenge pruefen.'),
    ('PDF-STUB-COLESLAW-KRAEUTERQUARK', 'Coleslaw | Kräuterquark', 'PDF-Katalog 2026: Lunch-Position.', 'Unvollstaendiger Rezept-Stub: Rezeptur/Mengen pruefen.'),
    ('PDF-STUB-SALAT-ODER-SUPPE', 'Kleiner Salat oder Suppe', 'PDF-Katalog 2026: Lunch-Position mit Auswahl.', 'Unvollstaendiger Rezept-Stub: Auswahl fachlich aufsplitten oder Mengen pruefen.'),
    ('PDF-STUB-CHILI-SIN-CON-CARNE', 'Chili sin/con Carne | Koriander | Bauernbrot', 'PDF-Katalog 2026: Mitternachtssnack.', 'Unvollstaendiger Rezept-Stub: sin/con Varianten und Mengen pruefen.'),
    ('PDF-STUB-GEGRILLTES-HAEHNCHEN', 'Gegrilltes Hähnchen (PDF-Komponente)', 'PDF-Katalog 2026: Hähnchenbestandteil in Sommer/BBQ/Abend.', 'Unvollstaendiger Rezept-Stub: Garmethode und Portionsmenge pruefen.'),
    ('PDF-STUB-KABELJAU', 'Kabeljau (PDF-Komponente)', 'PDF-Katalog 2026: Kabeljau in Abend/Hochzeit.', 'Unvollstaendiger Rezept-Stub: Rohwarenmenge und Garverlust pruefen.'),
    ('PDF-STUB-POULARDE', 'Poulardenbrust (PDF-Komponente)', 'PDF-Katalog 2026: Poularde/Hähnchen-Hauptgang.', 'Unvollstaendiger Rezept-Stub: Rohwarenmenge und Garverlust pruefen.'),
    ('PDF-STUB-JUS', 'Jus (PDF-Komponente)', 'PDF-Katalog 2026: Fleisch-/Gefluegeljus.', 'Unvollstaendiger Rezept-Stub: Rezeptur/Menge pruefen.')
)
INSERT INTO public.recipes (
  recipe_code,
  name,
  description,
  base_portions,
  yield_quantity,
  yield_unit_id,
  preparation,
  usage_notes,
  production_notes,
  shelf_life,
  scalable,
  needs_review,
  recipe_status
)
SELECT recipe_code, name, 'Aus PDF-Katalog 2026 abgeleiteter Rezept-Stub.', 1, NULL, NULL, NULL, usage_notes, production_notes, NULL, true, true, 'incomplete'
FROM stubs s
WHERE NOT EXISTS (
  SELECT 1 FROM public.recipes r WHERE r.recipe_code = s.recipe_code
);

-- 05_caesar_positions
WITH new_positions(position_code, name, notes) AS (
  VALUES
    ('PDF-POS-CAESAR-OHNE-HAEHNCHEN', 'Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | ohne Hähnchen', 'Aus PDF-Katalog 2026 abgeleitete Verkaufsposition; Mengen pruefen.'),
    ('PDF-POS-CAESAR-MIT-HAEHNCHEN', 'Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | mit Hähnchen', 'Aus PDF-Katalog 2026 abgeleitete Verkaufsposition; Hähnchen-Komponente pruefen.')
)
INSERT INTO public.positions (position_code, name, notes)
SELECT position_code, name, notes
FROM new_positions np
WHERE NOT EXISTS (
  SELECT 1 FROM public.positions p WHERE p.position_code = np.position_code
);

WITH target_menu AS (
  SELECT id FROM public.menus WHERE menu_code = 'MENU_FINGERFOOD_2026'
),
target_positions AS (
  SELECT id, position_code FROM public.positions
  WHERE position_code IN ('PDF-POS-CAESAR-OHNE-HAEHNCHEN', 'PDF-POS-CAESAR-MIT-HAEHNCHEN')
),
base_sort AS (
  SELECT COALESCE(MAX(sort_order), 0) AS n
  FROM public.menu_positions mp
  JOIN target_menu tm ON tm.id = mp.menu_id
)
INSERT INTO public.menu_positions (menu_id, position_id, sort_order, is_add_on)
SELECT tm.id, tp.id, bs.n + ROW_NUMBER() OVER (ORDER BY tp.position_code), false
FROM target_menu tm, target_positions tp, base_sort bs
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_positions mp
  WHERE mp.menu_id = tm.id AND mp.position_id = tp.id
);

-- 06_component_links
WITH links(position_name, recipe_code, sort_order) AS (
  VALUES
    ('Caesar''s Salad – Romana Salatherzen | Parmesan | Teriyaki Sauce – m/o Hähnchen', 'PDF-STUB-ROMANA', 10),
    ('Caesar''s Salad – Romana Salatherzen | Parmesan | Teriyaki Sauce – m/o Hähnchen', 'PDF-STUB-PARMESAN', 20),
    ('Caesar''s Salad – Romana Salatherzen | Parmesan | Teriyaki Sauce – m/o Hähnchen', 'PDF-STUB-TERIYAKI', 30),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | ohne Hähnchen', 'SAU-010', 0),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | ohne Hähnchen', 'PDF-STUB-ROMANA', 10),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | ohne Hähnchen', 'PDF-STUB-PARMESAN', 20),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | ohne Hähnchen', 'PDF-STUB-TERIYAKI', 30),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | mit Hähnchen', 'SAU-010', 0),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | mit Hähnchen', 'PDF-STUB-ROMANA', 10),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | mit Hähnchen', 'PDF-STUB-PARMESAN', 20),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | mit Hähnchen', 'PDF-STUB-TERIYAKI', 30),
    ('Caesar''s Salad | Romana Salatherzen | Parmesan | Teriyaki Sauce | mit Hähnchen', 'PDF-STUB-CAESAR-CHICKEN', 40),
    ('Süßkartoffelspalten | Aioli | Parmesan | Frühlingzwiebel', 'PDF-STUB-SUESSKARTOFFEL', 10),
    ('Süßkartoffelspalten | Aioli | Parmesan | Frühlingzwiebel', 'PDF-STUB-PARMESAN', 20),
    ('Süßkartoffelspalten | Aioli | Parmesan | Frühlingzwiebel', 'PDF-STUB-FRUEHLINGSZWIEBEL', 30),
    ('Tomatensalat | Burrata', 'PDF-STUB-BURRATA', 10),
    ('Bunte Bete Salat | Burrata (Winter)', 'PDF-STUB-BURRATA', 10),
    ('Ofengemüse der Saison | Labneh | Zaatar', 'PDF-STUB-OFENGEMUESE-LABNEH', 0),
    ('Buntes Gemüse', 'PDF-STUB-BUNTES-GEMUESE', 0),
    ('Hausgemachtes Seitan Steak | Pak Choi | Sesam', 'PDF-STUB-SEITAN-PAKCHOI-SESAM', 0),
    ('Hausgemachtes veganes Steak aus Seitan | Pak Choi | Sesam', 'PDF-STUB-SEITAN-PAKCHOI-SESAM', 0),
    ('Pimiento del Padrón | Harissa | Meersalz', 'PDF-STUB-PIMIENTO-HARISSA', 0),
    ('Pimientos del Padron | Sesam | Wasabi-Mayonnaise', 'PDF-STUB-PIMIENTOS-WASABI', 0),
    ('Ceviche | Fisch des Tages | Habanero Tigermilch | Avocado | Süßkartoffelchips', 'PDF-STUB-CEVICHE', 0),
    ('Langsam gegartes Roastbeef | gebrannte Senfsauce | grüner Apfel | Zitrone', 'PDF-STUB-ROASTBEEF-SENFSAUCE', 0),
    ('Coleslaw | Kräuterquark', 'PDF-STUB-COLESLAW-KRAEUTERQUARK', 0),
    ('Kleiner Salat oder Suppe', 'PDF-STUB-SALAT-ODER-SUPPE', 0),
    ('Chili sin/con Carne | Koriander | Bauernbrot', 'PDF-STUB-CHILI-SIN-CON-CARNE', 0),
    ('Gegrilltes Hähnchen | Schnittlauch-Aioli', 'PDF-STUB-GEGRILLTES-HAEHNCHEN', 10),
    ('Hühnchen', 'PDF-STUB-GEGRILLTES-HAEHNCHEN', 10),
    ('Gegarter Kabeljau | Spinat | Rosinen | Pinienkerne | Zitrus-Beurre Blanc', 'PDF-STUB-KABELJAU', 10),
    ('Gebratener Kabeljau | Kräuter-Beurre-Blanc | frischer Spinat | Rosinen | Pinienkerne', 'PDF-STUB-KABELJAU', 10),
    ('Poulardenbrust | Nussbutter-Kartoffel-Püree | Jus', 'PDF-STUB-POULARDE', 10),
    ('Poulardenbrust | Nussbutter-Kartoffel-Püree | Jus', 'PDF-STUB-JUS', 20),
    ('Gebratene Hähnchenbrust | geröstete Karotten | Karottenpüree | Kräuteröl | Jus', 'PDF-STUB-GEGRILLTES-HAEHNCHEN', 10),
    ('Gebratene Hähnchenbrust | geröstete Karotten | Karottenpüree | Kräuteröl | Jus', 'PDF-STUB-JUS', 20)
)
INSERT INTO public.position_components (position_id, recipe_id, quantity, unit_id, sort_order)
SELECT p.id, r.id, 1, NULL, l.sort_order
FROM links l
JOIN public.positions p ON p.name = l.position_name
JOIN public.recipes r ON r.recipe_code = l.recipe_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.position_components pc
  WHERE pc.position_id = p.id
    AND pc.recipe_id = r.id
);

UPDATE public.positions
SET notes = COALESCE(notes || E'\n', '') || 'PDF-Katalog 2026: Komponenten/Rezeptbezug automatisch ergänzt; Mengen fachlich prüfen.'
WHERE id IN (
  SELECT DISTINCT position_id
  FROM public.position_components pc
  JOIN public.recipes r ON r.id = pc.recipe_id
  WHERE r.recipe_code LIKE 'PDF-STUB-%'
)
  AND COALESCE(notes, '') NOT ILIKE '%PDF-Katalog 2026: Komponenten/Rezeptbezug automatisch ergänzt%';

-- 07_schema_reload
NOTIFY pgrst, 'reload schema';
