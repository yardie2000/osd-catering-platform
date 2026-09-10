-- Grana Padano in Parmesan zusammenführen (Grana Padano = Parmesan lt. Küche).
-- Verschiebt die Lieferantenartikel-Zuordnung auf die kanonische Zutat "Parmesan"
-- (ING-0068), benennt den Artikelbezug um und löscht die nun leere Zutat.
-- Idempotent und portabel (per Name/Code, nicht per fester UUID).

DO $$
DECLARE g uuid; p uuid;
BEGIN
  SELECT id INTO p FROM public.ingredients WHERE lower(name)='parmesan'
    ORDER BY (ingredient_code='ING-0068') DESC,
             (SELECT count(*) FROM public.recipe_ingredients r WHERE r.ingredient_id=ingredients.id) DESC
    LIMIT 1;
  SELECT id INTO g FROM public.ingredients WHERE lower(name)='grana padano' LIMIT 1;
  IF g IS NOT NULL AND p IS NOT NULL AND g <> p THEN
    UPDATE public.ingredient_supplier_articles SET is_preferred=false
      WHERE ingredient_id=g AND is_preferred
        AND EXISTS(SELECT 1 FROM public.ingredient_supplier_articles WHERE ingredient_id=p AND is_preferred);
    UPDATE public.ingredient_supplier_articles SET ingredient_id=p WHERE ingredient_id=g;
    UPDATE public.supplier_articles SET ingredient_name_de='Parmesan' WHERE lower(ingredient_name_de)='grana padano';
    DELETE FROM public.ingredients WHERE id=g
      AND NOT EXISTS(SELECT 1 FROM public.recipe_ingredients WHERE ingredient_id=g)
      AND NOT EXISTS(SELECT 1 FROM public.ingredient_supplier_articles WHERE ingredient_id=g);
  END IF;
END $$;
