-- Selgros-Lieferantenartikel-Import (82 Artikel) + Zutaten-Zuordnung
-- Quelle: OSD CATERING/orderlisten/Selgros/Jenny OSD - CSV(Sheet1).csv
-- Legt Lieferant "Selgros" an, importiert alle Artikel (Artikelnummer, Netto-EK,
-- Gebinde/Inhalt) und ordnet jeden Artikel einer Zutat zu (bestehende oder neu).
-- Idempotent: Artikel per (supplier, Artikelnummer), Zutat per Name, Mapping per Paar.

INSERT INTO public.suppliers(supplier_code, name, active)
VALUES ('selgros','Selgros',true)
ON CONFLICT (supplier_code) DO NOTHING;

CREATE OR REPLACE FUNCTION pg_temp._sup() RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.suppliers WHERE supplier_code='selgros' LIMIT 1 $$;

CREATE OR REPLACE FUNCTION pg_temp._ing2(p_name text, p_note text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid; base text; code text; n int:=2;
BEGIN
  SELECT id INTO v FROM public.ingredients WHERE lower(name)=lower(p_name) LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  base := 'SEL-'||upper(regexp_replace(substr(p_name,1,24),'[^A-Za-z0-9]+','-','g'));
  code := base;
  WHILE EXISTS(SELECT 1 FROM public.ingredients WHERE ingredient_code=code) LOOP
    code := base||'-'||n; n := n+1;
  END LOOP;
  INSERT INTO public.ingredients(ingredient_code,name,category,allergens,notes)
  VALUES(code,p_name,'Lieferanten-Import (Selgros)','{}',p_note) RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION pg_temp._sa(
  p_artno text, p_raw text, p_ing text, p_price numeric, p_price_unit text,
  p_cq numeric, p_cu text, p_bu text, p_ppb numeric,
  p_bio boolean, p_frozen boolean, p_fresh boolean, p_pref boolean, p_review boolean
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE sid uuid; said uuid; ing uuid; pf boolean;
BEGIN
  sid := pg_temp._sup();
  IF EXISTS(SELECT 1 FROM public.supplier_articles WHERE supplier_id=sid AND supplier_article_number=p_artno) THEN
    RETURN;
  END IF;
  INSERT INTO public.supplier_articles(
    supplier_id, supplier_article_number, raw_article_name, clean_article_name_de, ingredient_name_de,
    is_food, is_frozen, is_fresh, is_bio, packaging_unit, content_quantity, content_unit, base_unit,
    ek_single_price_net, ek_price_unit, ek_price_per_base_unit, currency, is_active, match_key, last_source_file
  ) VALUES(
    sid, p_artno, p_raw, p_raw, p_ing,
    true, p_frozen, p_fresh, p_bio, p_price_unit, p_cq, p_cu, p_bu,
    p_price, p_price_unit, p_ppb, 'EUR', true, 'selgros:'||p_artno, 'Jenny OSD - CSV(Sheet1).csv'
  ) RETURNING id INTO said;
  ing := pg_temp._ing2(p_ing, 'Aus Selgros-Import angelegt.');
  IF NOT EXISTS(SELECT 1 FROM public.ingredient_supplier_articles WHERE ingredient_id=ing AND supplier_article_id=said) THEN
    pf := p_pref AND NOT EXISTS(SELECT 1 FROM public.ingredient_supplier_articles WHERE ingredient_id=ing AND is_preferred);
    INSERT INTO public.ingredient_supplier_articles(
      ingredient_id, supplier_article_id, match_type, match_score, is_preferred, needs_review, review_reason, priority
    ) VALUES(
      ing, said, 'manuell', 100, pf, p_review,
      CASE WHEN p_review THEN 'Selgros-Import: Zutat/Zuordnung pruefen' END, 100
    );
  END IF;
END $$;

SELECT pg_temp._sa('5012','Markenbutter Alu 250g','Butter',1.15,'Stück',250.0,'g','kg',4.6,false,false,false,true,false);
SELECT pg_temp._sa('11475','Belugalinsen TGQ 1kg','Beluga-Linsen',3.523,'Stück',1.0,'kg','kg',3.523,false,false,false,true,false);
SELECT pg_temp._sa('27564','Erbsen jung s.feinTK TGQ 2.5kg','Erbsen (TK)',6.476,'Stück',2.5,'kg','kg',2.5904,false,false,false,true,false);
SELECT pg_temp._sa('39391','Mault.2.0 vega.FR BW Bü.300g','Maultaschen vegan',2.273,'Stück',300.0,'g','kg',7.5767,false,false,true,true,false);
SELECT pg_temp._sa('41126','Rapsöl PET TGE 10l','Rapsöl',14.549,'Stück',10.0,'l','l',1.4549,false,false,false,true,false);
SELECT pg_temp._sa('56203','Grana Pa.32%14M.DOP TGQ ca.2kg','Grana Padano',14.859,'kg',2.0,'kg','kg',14.859,false,false,false,true,false);
SELECT pg_temp._sa('57103','Köllnfl.kernig Köl.500g','Haferflocken',1.339,'Stück',500.0,'g','kg',2.678,false,false,false,true,false);
SELECT pg_temp._sa('60711','Auberg.viol.Kl.I TGQ 300-400g','Auberginen',2.742,'kg',400.0,'g','kg',2.742,false,false,false,true,false);
SELECT pg_temp._sa('68647','FF-Brioche Burg.Mi.TK Ed70x30g','Brioche (Mini, TK)',26.36,'Karton',2100.0,'g','kg',12.5524,false,true,false,true,false);
SELECT pg_temp._sa('80892','Bio Kefir 1,5% EW AD.500g','Kefir (Bio)',1.274,'Stück',500.0,'g','kg',2.548,true,false,false,true,false);
SELECT pg_temp._sa('98700','Tom.Mark BW Oro.200g','Tomatenmark',1.525,'Stück',200.0,'g','kg',7.625,false,false,false,true,false);
SELECT pg_temp._sa('102940','Kart.Salat Essig Öl TGQ 3kg','Kartoffelsalat (zugekauft)',8.985,'Stück',3.0,'kg','kg',2.995,false,false,false,true,false);
SELECT pg_temp._sa('123757','Koriander TGQ 100g','Koriander',2.923,'Stück',100.0,'g','kg',29.23,false,false,false,true,false);
SELECT pg_temp._sa('153883','Soja-Jogh.Skyr Nat. Alp.400g','Soja-Joghurt Skyr',1.623,'Stück',400.0,'g','kg',4.0575,false,false,false,true,false);
SELECT pg_temp._sa('167742','Kichererbsen TGQ 2,65l','Kichererbsen (Dose)',2.912,'Stück',2.65,'l','l',1.0989,false,false,false,true,false);
SELECT pg_temp._sa('176823','Die Vegane Meg.250g','Vegane Mett (Die Vegane)',2.011,'Stück',250.0,'g','kg',8.044,false,false,false,true,true);
SELECT pg_temp._sa('181419','H-Schlagsahne 30% Milr.1l','Schlagsahne',3.588,'Stück',1.0,'l','l',3.588,false,false,false,true,false);
SELECT pg_temp._sa('182442','Austernseitling Kl.I','Austernpilze',7.038,'kg',NULL,NULL,'kg',7.038,false,false,false,true,false);
SELECT pg_temp._sa('185004','Eifix Eiweiß fl.BoHa 1kg','Eiweiß',3.877,'Stück',1.0,'kg','kg',3.877,false,false,false,true,false);
SELECT pg_temp._sa('185011','Bio Eifix Vollei fl.1kg','Vollei flüssig',7.279,'Stück',1.0,'kg','kg',7.279,true,false,false,true,false);
SELECT pg_temp._sa('189273','Bio Kuv.Drops ZB TGN 1kg','Kuvertüre Zartbitter',26.233,'Stück',1.0,'kg','kg',26.233,true,false,false,true,true);
SELECT pg_temp._sa('192231','Speisequark mager ja!500g','Quark',1.096,'Stück',500.0,'g','kg',2.192,false,false,false,true,false);
SELECT pg_temp._sa('196743','Staudensellerie Kl.I','Selleriestangen',1.417,'Stück',NULL,NULL,NULL,NULL,false,false,false,true,false);
SELECT pg_temp._sa('222287','Hä.Br.Filet o.H.PL FR ca.2,5kg','Hähnchenbrustfilet',7.28,'kg',2.5,'kg','kg',7.28,false,false,true,true,false);
SELECT pg_temp._sa('230694','Kohlrabi Kl.I','Kohlrabi (groß)',0.624,'Stück',NULL,NULL,NULL,NULL,false,false,false,true,false);
SELECT pg_temp._sa('253698','Maish.Bru.Sup.FRA FR 4xca.200g','Maishähnchen-Brust (Suprême)',10.475,'kg',NULL,NULL,'kg',10.475,false,false,true,true,false);
SELECT pg_temp._sa('279328','Laugenstange TK Ed.90x100g','Laugenstange (TK)',39.0,'Karton',9000.0,'g','kg',4.3333,false,true,false,true,false);
SELECT pg_temp._sa('301672','Brokkoli Bimi 200g','Bimi (Broccolini)',2.69,'Stück',200.0,'g','kg',13.45,false,false,false,true,false);
SELECT pg_temp._sa('323440','Maultasch.Gemüse Fr.Bü.BW 360g','Maultaschen Gemüse',2.289,'Stück',360.0,'g','kg',6.3583,false,false,true,true,false);
SELECT pg_temp._sa('325195','Sesampaste Sun.300g','Sesampaste (Tahini)',2.853,'Stück',300.0,'g','kg',9.51,false,false,false,true,false);
SELECT pg_temp._sa('329837','Eier L br.Freil.LdG.30St','Eier',8.331,'Stück',30.0,'Stück','Stück',0.2777,false,false,false,true,false);
SELECT pg_temp._sa('330755','Pelati Gastro Mut.2,65l','Tomaten, Pelati (Dose)',6.269,'Stück',2.65,'l','l',2.3657,false,false,false,true,false);
SELECT pg_temp._sa('333256','H-Milch 3,5% RECAP TGE 1l','Milch',0.79,'Stück',1.0,'l','l',0.79,false,false,false,true,false);
SELECT pg_temp._sa('335436','Hä.br.fil.DB FR ca.200g3kg','Hähnchenbrustfilet',8.1,'kg',3.0,'kg','kg',8.1,false,false,true,false,false);
SELECT pg_temp._sa('359240','Sesamöl Dia.250ml','Sesamöl',3.731,'Stück',250.0,'ml','l',14.924,false,false,false,true,false);
SELECT pg_temp._sa('363968','Kart.Wfl.10mm gek.Gro.2kg','Kartoffelwürfel (gekocht, 10 mm)',3.186,'Stück',2.0,'kg','kg',1.593,false,false,false,true,false);
SELECT pg_temp._sa('369170','Raffinade ja!1kg','Zucker',0.929,'Stück',1.0,'kg','kg',0.929,false,false,false,true,false);
SELECT pg_temp._sa('370186','Avocado Hass genussreif','Avocado',1.334,'Stück',NULL,NULL,NULL,NULL,false,false,false,true,false);
SELECT pg_temp._sa('412039','Kart.Wfl.20mm gek.Gro.2kg','Kartoffelwürfel (gekocht, 20 mm)',3.186,'Stück',2.0,'kg','kg',1.593,false,false,false,true,false);
SELECT pg_temp._sa('415563','Romanasalat Kl.I','Romana Salatherzen',1.248,'Stück',NULL,NULL,NULL,NULL,false,false,false,true,false);
SELECT pg_temp._sa('439312','Philadel.Nat.68% 500g','Frischkäse (Philadelphia)',6.194,'Stück',500.0,'g','kg',12.388,false,false,false,true,false);
SELECT pg_temp._sa('447811','Haferfl.zart ja!500g','Haferflocken',0.637,'Stück',500.0,'g','kg',1.274,false,false,false,false,false);
SELECT pg_temp._sa('465758','Bio H-Milch 3,8% Arla 1l','Milch',1.34,'Stück',1.0,'l','l',1.34,true,false,false,false,false);
SELECT pg_temp._sa('469455','EU Rind.Dicker Bug','Rind (Dicker Bug)',12.435,'kg',NULL,NULL,'kg',12.435,false,false,false,true,false);
SELECT pg_temp._sa('469974','Rigatoni No24 DeC.500g','Rigatoni',1.789,'Stück',500.0,'g','kg',3.578,false,false,false,true,false);
SELECT pg_temp._sa('514996','Mozzarella Mini 45% TGQ 125x8g','Mozzarella Mini',6.214,'Stück',1000.0,'g','kg',6.214,false,false,false,true,false);
SELECT pg_temp._sa('515507','HACKFLEISCH GEMISCHT Z.BRAT. Z','Hackfleisch',7.5,'kg',NULL,NULL,'kg',7.5,false,false,false,true,false);
SELECT pg_temp._sa('515510','RINDER HACKFLEISCH Z.BRATEN Z','Rinderhackfleisch',12.333,'kg',NULL,NULL,'kg',12.333,false,false,false,true,false);
SELECT pg_temp._sa('531618','Hä.Ob.keu.fl.oHoKn.DM FR70g3kg','Hähnchen-Oberkeulenfilet',6.125,'kg',3.0,'kg','kg',6.125,false,false,false,true,false);
SELECT pg_temp._sa('533809','Schlagcr.Univ.unges.S-Fix.1l','Schlagcreme Universal (ungesüßt)',3.467,'Stück',1.0,'l','l',3.467,false,false,false,true,true);
SELECT pg_temp._sa('566715','Ananas sweet Kl.I','Ananas',2.459,'Stück',NULL,NULL,NULL,NULL,false,false,false,true,false);
SELECT pg_temp._sa('566724','Brombeere Kl.I 125g','Brombeeren',3.159,'Stück',125.0,'g','kg',25.272,false,false,false,true,false);
SELECT pg_temp._sa('584623','Zwieb.Wfl.10x10mm TK AF.2,5kg','Zwiebelwürfel (TK)',3.709,'Stück',2.5,'kg','kg',1.4836,false,true,false,true,false);
SELECT pg_temp._sa('644921','Essigessenz hell 25% Sur.2l','Essigessenz (25%)',5.699,'Stück',2.0,'l','l',2.8495,false,false,false,true,false);
SELECT pg_temp._sa('654739','Kart.Salat Essig u.Öl TGQ 5kg','Kartoffelsalat (zugekauft)',13.39,'Stück',5.0,'kg','kg',2.678,false,false,false,false,false);
SELECT pg_temp._sa('663700','Thunfisch Chunks i.Öl TGE 185g','Thunfisch aus der Dose',1.269,'Stück',185.0,'g','kg',6.8595,false,false,false,true,false);
SELECT pg_temp._sa('664028','Thunf.Chunks i.Wass.TGE 185g','Thunfisch aus der Dose',1.283,'Stück',185.0,'g','kg',6.9351,false,false,false,false,false);
SELECT pg_temp._sa('684194','Kokosnussmil.17%.Aroy.1l','Kokosmilch',3.471,'Stück',1.0,'l','l',3.471,false,false,false,true,false);
SELECT pg_temp._sa('687243','Hummus FR Po.1kg','Hummus',8.721,'Stück',1.0,'kg','kg',8.721,false,false,true,true,false);
SELECT pg_temp._sa('706807','Gurkentöpferl Du.720ml','Gewürzgurken',1.51,'Stück',720.0,'ml','l',2.0972,false,false,false,true,false);
SELECT pg_temp._sa('742655','Kidneybohnen TGQ 3,1l','Rote Bohnen',4.867,'Stück',3.1,'l','l',1.57,false,false,false,true,false);
SELECT pg_temp._sa('747053','JA! Forellenfilets 125g','Forellenfilet',2.542,'Stück',125.0,'g','kg',20.336,false,false,false,true,false);
SELECT pg_temp._sa('748061','Maiskörner TGQ.850ml','Mais',1.574,'Stück',850.0,'ml','l',1.8518,false,false,false,true,false);
SELECT pg_temp._sa('756957','Haferdrink Barista Edit. Oat1l','Hafermilch',1.89,'Stück',1.0,'l','l',1.89,false,false,false,true,false);
SELECT pg_temp._sa('761075','Beerencocktail TK GC.1kg','Waldbeeren',5.136,'Stück',1.0,'kg','kg',5.136,false,true,false,true,false);
SELECT pg_temp._sa('761895','Paprika mix Kl.I 70-90 500g','Paprika',2.349,'Stück',500.0,'g','kg',4.698,false,false,false,true,false);
SELECT pg_temp._sa('782082','Petersilie glatt TGQ 250g','Petersilie',2.34,'Stück',250.0,'g','kg',9.36,false,false,false,true,false);
SELECT pg_temp._sa('791641','Tom.Mark ja!200g','Tomatenmark',0.806,'Stück',200.0,'g','kg',4.03,false,false,false,false,false);
SELECT pg_temp._sa('792554','Maultaschen vega.TK BW Bü.1kg','Maultaschen vegan',6.284,'Stück',1.0,'kg','kg',6.284,false,true,false,false,false);
SELECT pg_temp._sa('820106','Couscous TGQ 1kg','Couscous',2.301,'Stück',1.0,'kg','kg',2.301,false,false,false,true,false);
SELECT pg_temp._sa('830425','Mayo. vegan Hellm.3l','Vegane Mayonnaise',13.702,'Stück',3.0,'l','l',4.5673,false,false,false,true,false);
SELECT pg_temp._sa('832564','Salakis Block 48% ca.2kg','Feta',13.182,'kg',2.0,'kg','kg',13.182,false,false,false,true,false);
SELECT pg_temp._sa('832855','Soja-Jogh.Nat. Alp.400g','Soja-Joghurt natur',1.288,'Stück',400.0,'g','kg',3.22,false,false,false,true,false);
SELECT pg_temp._sa('851869','Schlagcreme gesüßt S-Fix.1l','Schlagcreme (gesüßt)',3.592,'Stück',1.0,'l','l',3.592,false,false,false,true,true);
SELECT pg_temp._sa('882245','Bio Eier S-XL w./br. TGN 10St','Eier',3.558,'Stück',10.0,'Stück','Stück',0.3558,true,false,false,false,false);
SELECT pg_temp._sa('897885','Jungbu.Roastb.hal.DE FRca2,5kg','Roastbeef (Jungbulle)',22.189,'kg',2.5,'kg','kg',22.189,false,false,false,true,false);
SELECT pg_temp._sa('904593','Weizenmehl T405 BW TGE 1kg','Mehl (Type 405)',0.572,'Stück',1.0,'kg','kg',0.572,false,false,false,true,false);
SELECT pg_temp._sa('942393','Tomaten Wfl.m.Ht.TK Pi.2,5kg','Tomatenwürfel (TK)',4.188,'Stück',2.5,'kg','kg',1.6752,false,true,false,true,false);
SELECT pg_temp._sa('943871','Kapern Capotes Pic. 720ml','Kapern',2.925,'Stück',720.0,'ml','l',4.0625,false,false,false,true,false);
SELECT pg_temp._sa('989780','Mozzarella 45% ja!125g','Mozzarella',0.662,'Stück',125.0,'g','kg',5.296,false,false,false,true,false);
SELECT pg_temp._sa('991030','Minze TGQ 100g','Minze',2.936,'Stück',100.0,'g','kg',29.36,false,false,false,true,false);
SELECT pg_temp._sa('995155','Brugge Alt 50% 200g','Brugge Käse (alt)',4.238,'Stück',200.0,'g','kg',21.19,false,false,false,true,true);
