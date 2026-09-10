-- ============================================================================
-- Seed: Zutaten aus dem Küchen-Review ("Receipe Review", Druck 08.07.2026)
-- ============================================================================
-- Trägt die vom Koch handschriftlich ergänzten bzw. abgeleiteten Zutaten in
-- 19 Rezepte ein (bisher leere PDF-Stubs + einzelne Ergänzungen an bestehenden
-- Rezepten) und korrigiert eine Menge (Chia Pudding · Chiasamen 100 -> 175 g).
--
-- Eigenschaften:
--   * Idempotent: Rezept/Zutat/Einheit werden per natürlichem Schlüssel
--     (Code bzw. Name, case-insensitiv) aufgelöst; eine recipe_ingredients-Zeile
--     wird nur eingefügt, wenn sie noch nicht existiert.
--   * Fehlende Master-Zutaten werden mit generiertem Code 'REV-…' angelegt.
--   * Nur INSERT/UPDATE, keine Löschungen.
--
-- Kennzeichnung in notes:
--   * 'DRAFT …'  = aus Beschreibung/Standardrezept abgeleiteter Entwurf
--                  (nicht vom Koch bestätigt) — vor produktivem Einsatz prüfen.
--   * 'Standard-Schätzung …' = Mengen geschätzt (Koch schrieb keine Mengen).
--
-- Bewusst NICHT enthalten (Rückfrage Koch): Ceviche, Coleslaw|Kräuterquark,
-- "Kleiner Salat oder Suppe" (Platzhalter), Roastbeef-Teller (komponiert).
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp._unit(p_label text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid; BEGIN
  SELECT id INTO v FROM public.units
   WHERE lower(short_name)=lower(p_label) OR lower(unit_code)=lower(p_label) OR lower(name)=lower(p_label) LIMIT 1;
  RETURN v; END $$;

CREATE OR REPLACE FUNCTION pg_temp._ing(p_name text, p_unit text, p_all text[]) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid; c text; BEGIN
  SELECT id INTO v FROM public.ingredients WHERE lower(name)=lower(p_name) LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  c := 'REV-'||upper(regexp_replace(substr(p_name,1,22),'[^A-Za-z0-9]+','-','g'));
  INSERT INTO public.ingredients(ingredient_code,name,default_unit_id,allergens)
   VALUES(c,p_name,pg_temp._unit(p_unit),COALESCE(p_all,'{}'))
   ON CONFLICT(ingredient_code) DO UPDATE SET name=EXCLUDED.name RETURNING id INTO v;
  RETURN v; END $$;

CREATE OR REPLACE FUNCTION pg_temp._add(p_recipe text,p_ing text,p_qty numeric,p_unit text,p_notes text DEFAULT NULL,p_all text[] DEFAULT '{}') RETURNS void LANGUAGE plpgsql AS $$
DECLARE r uuid; u uuid; i uuid; BEGIN
  SELECT id INTO r FROM public.recipes WHERE lower(recipe_code)=lower(p_recipe) OR lower(name)=lower(p_recipe)
    ORDER BY (lower(recipe_code)=lower(p_recipe)) DESC LIMIT 1;
  IF r IS NULL THEN RAISE NOTICE 'no recipe %',p_recipe; RETURN; END IF;
  u := pg_temp._unit(p_unit);
  IF u IS NULL THEN RAISE NOTICE 'no unit % for %',p_unit,p_recipe; RETURN; END IF;
  i := pg_temp._ing(p_ing,p_unit,p_all);
  IF EXISTS(SELECT 1 FROM public.recipe_ingredients WHERE recipe_id=r AND ingredient_id=i) THEN RETURN; END IF;
  INSERT INTO public.recipe_ingredients(recipe_id,ingredient_id,quantity,unit_id,notes) VALUES(r,i,p_qty,u,p_notes);
END $$;

-- #4 Avocado-Koriander-Sauce (vom Koch bestätigt)
SELECT pg_temp._add('Avocado-Koriander-Sauce','Avocado',300,'g');
SELECT pg_temp._add('Avocado-Koriander-Sauce','Koriander',3,'Stück','3 Bund');
SELECT pg_temp._add('Avocado-Koriander-Sauce','Knoblauch',5,'g');
SELECT pg_temp._add('Avocado-Koriander-Sauce','Chili',5,'g');
SELECT pg_temp._add('Avocado-Koriander-Sauce','Limette',5,'g');
SELECT pg_temp._add('Avocado-Koriander-Sauce','Joghurt',1,'n.B.','in Beschreibung genannt',ARRAY['Milch']);
-- #13 Chili sin/con Carne
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Rote Bohnen',1.25,'kg','Rote Bohnen + Mais zusammen 2,5 kg');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Mais',1.25,'kg','Rote Bohnen + Mais zusammen 2,5 kg');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Hackfleisch',1,'kg','con carne; für sin carne weglassen');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Koriander',300,'g');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Zwiebeln',200,'g');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Lorbeerblatt',2,'Stück');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Salz',25,'g');
SELECT pg_temp._add('PDF-STUB-CHILI-SIN-CON-CARNE','Pfeffer',1,'n.B.');
-- #29 Granola
SELECT pg_temp._add('DES-019','Haferflocken',1,'kg');
SELECT pg_temp._add('DES-019','Nussmischung',1,'kg',NULL,ARRAY['Schalenfrüchte']);
SELECT pg_temp._add('DES-019','Agavensirup',300,'ml');
-- #63 Pimiento del Padrón | Harissa
SELECT pg_temp._add('PDF-STUB-PIMIENTO-HARISSA','Padrón-Paprika',2,'kg');
SELECT pg_temp._add('PDF-STUB-PIMIENTO-HARISSA','Meersalz',6,'g','5-7 g');
SELECT pg_temp._add('PDF-STUB-PIMIENTO-HARISSA','Harissa',3,'g','vom Koch bestätigt');
-- #20 Fermentierte Karotten (Ergänzung)
SELECT pg_temp._add('Fermentierte Karotten','Apfelessig',50,'ml','handschriftlich ergänzt (bestätigt)');
-- #26 Gemüsemuffins
SELECT pg_temp._add('FRU-003','Zucchini',350,'g','Zucchini gut ausdrücken');
SELECT pg_temp._add('FRU-003','Zwiebeln',150,'g');
SELECT pg_temp._add('FRU-003','Mehl (Type 405)',500,'g','Standard-Muffinteig',ARRAY['Gluten']);
SELECT pg_temp._add('FRU-003','Vollei flüssig',250,'g','Standard-Muffinteig',ARRAY['Eier']);
SELECT pg_temp._add('FRU-003','Backpulver',15,'g','Standard-Muffinteig');
-- #28 Gilda (pro Spieß)
SELECT pg_temp._add('PRO-013','Olive',2,'Stück','pro Spieß');
SELECT pg_temp._add('PRO-013','Piparra',1,'Stück','pro Spieß');
SELECT pg_temp._add('PRO-013','Sardelle',1,'Stück','pro Spieß',ARRAY['Fisch']);
-- #30 Gremolata
SELECT pg_temp._add('GEM-021','Petersilie',200,'g');
SELECT pg_temp._add('GEM-021','Knoblauch',40,'g','5:1 Petersilie:Knoblauch');
SELECT pg_temp._add('GEM-021','Zitronenschale',5,'g');
SELECT pg_temp._add('GEM-021','Olivenöl',75,'ml','vom Koch bestätigt');
-- #53 Obstsalat (Mengen geschätzt)
SELECT pg_temp._add('Obstsalat (hausgemacht)','Wassermelone',3,'kg','Standard-Schätzung 50 Port.');
SELECT pg_temp._add('Obstsalat (hausgemacht)','Melone',2,'kg','Standard-Schätzung 50 Port.');
SELECT pg_temp._add('Obstsalat (hausgemacht)','Mango',1.5,'kg','Standard-Schätzung 50 Port.');
SELECT pg_temp._add('Obstsalat (hausgemacht)','Kiwi',1,'kg','Standard-Schätzung 50 Port.');
SELECT pg_temp._add('Obstsalat (hausgemacht)','Apfel',1,'kg','Standard-Schätzung 50 Port.');
-- #54 Ofengemüse der Saison
SELECT pg_temp._add('PDF-STUB-OFENGEMUESE-LABNEH','Zucchini',500,'g','je 500 g');
SELECT pg_temp._add('PDF-STUB-OFENGEMUESE-LABNEH','Aubergine',500,'g','je 500 g');
SELECT pg_temp._add('PDF-STUB-OFENGEMUESE-LABNEH','Paprika',500,'g','je 500 g');
SELECT pg_temp._add('PDF-STUB-OFENGEMUESE-LABNEH','Salz',1,'n.B.');
SELECT pg_temp._add('PDF-STUB-OFENGEMUESE-LABNEH','Pfeffer',1,'n.B.');
-- #64 Pimientos del Padrón | Sesam | Wasabi
SELECT pg_temp._add('PDF-STUB-PIMIENTOS-WASABI','Padrón-Paprika',2,'kg');
SELECT pg_temp._add('PDF-STUB-PIMIENTOS-WASABI','Meersalz',6,'g','5-7 g');
SELECT pg_temp._add('PDF-STUB-PIMIENTOS-WASABI','Sesam',6,'g',NULL,ARRAY['Sesam']);
SELECT pg_temp._add('PDF-STUB-PIMIENTOS-WASABI','Wasabi',4,'g','~4 g Wasabi je 100 g Mayo');
SELECT pg_temp._add('PDF-STUB-PIMIENTOS-WASABI','Mayonnaise',100,'g',NULL,ARRAY['Eier']);
-- #38 Jus (DRAFT)
SELECT pg_temp._add('PDF-STUB-JUS','Rinderknochen',3,'kg','DRAFT');
SELECT pg_temp._add('PDF-STUB-JUS','Zwiebeln',300,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-JUS','Karotten',300,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-JUS','Sellerie',200,'g','DRAFT',ARRAY['Sellerie']);
SELECT pg_temp._add('PDF-STUB-JUS','Tomatenmark',150,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-JUS','Rotwein',750,'ml','DRAFT',ARRAY['Sulfite']);
SELECT pg_temp._add('PDF-STUB-JUS','Wasser',5,'l','DRAFT');
SELECT pg_temp._add('PDF-STUB-JUS','Lorbeerblatt',2,'Stück','DRAFT');
SELECT pg_temp._add('PDF-STUB-JUS','Pfefferkörner',1,'n.B.','DRAFT');
-- #45 Kräuteröl (DRAFT)
SELECT pg_temp._add('Kräuteröl (Grundrezept)','Frische Kräuter',330,'g','DRAFT');
SELECT pg_temp._add('Kräuteröl (Grundrezept)','Pflanzenöl',660,'ml','DRAFT');
-- #49 Maiskolben (DRAFT, aus Beschreibung)
SELECT pg_temp._add('Maiskolben (Feta, Mayo, Chili)','Maiskolben',2.5,'kg','DRAFT aus Beschreibung');
SELECT pg_temp._add('Maiskolben (Feta, Mayo, Chili)','Feta',260,'g','DRAFT aus Beschreibung',ARRAY['Milch']);
SELECT pg_temp._add('Maiskolben (Feta, Mayo, Chili)','Mayonnaise',1,'n.B.','DRAFT',ARRAY['Eier']);
SELECT pg_temp._add('Maiskolben (Feta, Mayo, Chili)','Chiliflocken',1,'n.B.','DRAFT');
-- #75 Teriyaki Sauce (DRAFT)
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Sojasauce',500,'ml','DRAFT',ARRAY['Soja','Gluten']);
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Mirin',250,'ml','DRAFT',ARRAY['Sulfite']);
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Zucker',150,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Ingwer',30,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Knoblauch',20,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Speisestärke',20,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-TERIYAKI','Wasser',200,'ml','DRAFT');
-- #78 Tofu-Marinade (DRAFT)
SELECT pg_temp._add('OEL-002','Sojasauce',500,'ml','DRAFT',ARRAY['Soja','Gluten']);
SELECT pg_temp._add('OEL-002','Pflanzenöl',250,'ml','DRAFT');
SELECT pg_temp._add('OEL-002','Ahornsirup',150,'ml','DRAFT');
SELECT pg_temp._add('OEL-002','Limette',3,'Stück','DRAFT');
SELECT pg_temp._add('OEL-002','Knoblauch',30,'g','DRAFT');
SELECT pg_temp._add('OEL-002','Ingwer',30,'g','DRAFT');
-- #81 Tramezzini Thunfisch (DRAFT)
SELECT pg_temp._add('Tramezzini Thunfisch','Tramazzini-Brot',1,'n.B.','DRAFT',ARRAY['Gluten']);
SELECT pg_temp._add('Tramezzini Thunfisch','Thunfisch-Mayonnaise',250,'g','DRAFT Vorprodukt #76',ARRAY['Fisch','Eier']);
SELECT pg_temp._add('Tramezzini Thunfisch','Salz',1,'n.B.','DRAFT');
SELECT pg_temp._add('Tramezzini Thunfisch','Pfeffer',1,'n.B.','DRAFT');
-- #83 Vanille-Flan (DRAFT)
SELECT pg_temp._add('Vanille-Flan','Milch',1,'l','DRAFT',ARRAY['Milch']);
SELECT pg_temp._add('Vanille-Flan','Vollei flüssig',300,'g','DRAFT',ARRAY['Eier']);
SELECT pg_temp._add('Vanille-Flan','Zucker',300,'g','DRAFT davon ~100 g Karamell');
SELECT pg_temp._add('Vanille-Flan','Vanilleschote',1,'Stück','DRAFT');
-- #36 Seitan Steak | Pak Choi | Sesam (DRAFT)
SELECT pg_temp._add('PDF-STUB-SEITAN-PAKCHOI-SESAM','Seitan-Steak',200,'g','DRAFT',ARRAY['Gluten']);
SELECT pg_temp._add('PDF-STUB-SEITAN-PAKCHOI-SESAM','Pak Choi',150,'g','DRAFT');
SELECT pg_temp._add('PDF-STUB-SEITAN-PAKCHOI-SESAM','Sesam',10,'g','DRAFT',ARRAY['Sesam']);
SELECT pg_temp._add('PDF-STUB-SEITAN-PAKCHOI-SESAM','Sojasauce',20,'ml','DRAFT',ARRAY['Soja','Gluten']);
SELECT pg_temp._add('PDF-STUB-SEITAN-PAKCHOI-SESAM','Sesamöl',10,'ml','DRAFT',ARRAY['Sesam']);
-- #12 Chia Pudding: vom Koch korrigierte Menge
UPDATE public.recipe_ingredients ri SET quantity=175
  FROM public.recipes r, public.ingredients ing
 WHERE ri.recipe_id=r.id AND ri.ingredient_id=ing.id
   AND lower(r.recipe_code)='des-016' AND lower(ing.name)='chiasamen';
