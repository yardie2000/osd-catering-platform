-- V4.2 STRICT yield sync — only recipes whose text explicitly says "N Portionen".
-- Touches ONLY recipes.yield_quantity. Never touches menu_items / links / ingredients.

update public.recipes set yield_quantity = 45 where recipe_code = 'SAU-010';  -- 200 → 45
update public.recipes set yield_quantity = 175 where recipe_code = 'SAU-011';  -- 150 → 175
update public.recipes set yield_quantity = 20 where recipe_code = 'SAU-014';  -- NULL → 20
update public.recipes set yield_quantity = 60 where recipe_code = 'SAU-016';  -- NULL → 60
update public.recipes set yield_quantity = 60 where recipe_code = 'DIP-004';  -- 50 → 60
update public.recipes set yield_quantity = 60 where recipe_code = 'DIP-005';  -- 50 → 60
update public.recipes set yield_quantity = 45 where recipe_code = 'PUE-010';  -- NULL → 45
update public.recipes set yield_quantity = 55 where recipe_code = 'GEM-007';  -- NULL → 55
update public.recipes set yield_quantity = 50 where recipe_code = 'GEM-008';  -- NULL → 50
update public.recipes set yield_quantity = 65 where recipe_code = 'GEM-016';  -- NULL → 65
update public.recipes set yield_quantity = 50 where recipe_code = 'FRU-002';  -- NULL → 50

notify pgrst, 'reload schema';