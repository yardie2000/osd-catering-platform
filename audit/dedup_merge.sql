-- V4.2 ingredient de-dup (E5) — re-point references to the canonical id, then drop the duplicate.
-- Fully reversible via audit/dedup_rollback.sql. REVIEW before running.

-- ING-0168 "sugar" (1 recipe links) → ING-0105 "Sugar"
update public.recipe_ingredients set ingredient_id = '24ab4f6b-b786-4d46-bf34-77c3bda20fbe' where ingredient_id = '679adcee-b56c-4093-90f6-931878f47b18';
delete from public.ingredients where id = '679adcee-b56c-4093-90f6-931878f47b18';

-- ING-0115 "Salt" (11 recipe links) → ING-0010 "Salz"
update public.recipe_ingredients set ingredient_id = 'b215c5dd-0279-4dc8-be9b-02c914eed3ad' where ingredient_id = '3f815294-164d-4b34-b10b-bbcbb64bb2c4';
delete from public.ingredients where id = '3f815294-164d-4b34-b10b-bbcbb64bb2c4';

-- ING-0167 "SALT 2 g Cashew praline" (1 recipe links) → ING-0010 "Salz"
update public.recipe_ingredients set ingredient_id = 'b215c5dd-0279-4dc8-be9b-02c914eed3ad' where ingredient_id = 'bc6c151d-bb11-4d96-ba39-0710c6c72a25';
delete from public.ingredients where id = 'bc6c151d-bb11-4d96-ba39-0710c6c72a25';

-- ING-0138 "Olive Oil" (1 recipe links) → ING-0009 "Olivenöl"
update public.recipe_ingredients set ingredient_id = '757b39a4-e4af-4529-a547-86fca1a12287' where ingredient_id = 'c29b7a0f-23ae-4dcf-a1ef-8941d411d3a3';
delete from public.ingredients where id = 'c29b7a0f-23ae-4dcf-a1ef-8941d411d3a3';

-- ING-0147 "Lemon Juice" (1 recipe links) → ING-0020 "Zitronensaft"
update public.recipe_ingredients set ingredient_id = '0752fe9a-ece0-484a-aeef-532ca0c1e9a5' where ingredient_id = '52ad235a-358e-4e4a-9b37-d81f77327989';
delete from public.ingredients where id = '52ad235a-358e-4e4a-9b37-d81f77327989';

-- ING-0148 "Mustard" (1 recipe links) → ING-0023 "Senf"
update public.recipe_ingredients set ingredient_id = '54238eba-0682-4ea7-903d-0c507117cfb2' where ingredient_id = 'dfde793a-358f-4229-805a-7006bd5871f2';
delete from public.ingredients where id = 'dfde793a-358f-4229-805a-7006bd5871f2';

-- ING-0101 "H2O" (9 recipe links) → ING-0016 "Wasser"
update public.recipe_ingredients set ingredient_id = 'c4be1a4f-6f38-4cc8-93d5-42c46014f6e3' where ingredient_id = 'cb812cc5-f2c3-450f-ae47-c2f54829523f';
delete from public.ingredients where id = 'cb812cc5-f2c3-450f-ae47-c2f54829523f';

-- ING-0169 "water (on500 gr Cashew)" (1 recipe links) → ING-0016 "Wasser"
update public.recipe_ingredients set ingredient_id = 'c4be1a4f-6f38-4cc8-93d5-42c46014f6e3' where ingredient_id = '513a1b03-c3f6-4dd0-a986-7c9486027ab3';
delete from public.ingredients where id = '513a1b03-c3f6-4dd0-a986-7c9486027ab3';

-- ING-0112 "Egg Yolk" (3 recipe links) → ING-0097 "Eigelb"
update public.recipe_ingredients set ingredient_id = '4ac007a0-cb6e-4573-a313-7edcf87368c4' where ingredient_id = '12e31c8d-4a2e-403d-ae63-81a7cd21b54a';
delete from public.ingredients where id = '12e31c8d-4a2e-403d-ae63-81a7cd21b54a';

notify pgrst, 'reload schema';