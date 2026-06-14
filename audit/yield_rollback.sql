-- Rollback for yield_sync.sql — restores prior recipes.yield_quantity values.

update public.recipes set yield_quantity = 200 where recipe_code = 'SAU-010';
update public.recipes set yield_quantity = 150 where recipe_code = 'SAU-011';
update public.recipes set yield_quantity = NULL where recipe_code = 'SAU-014';
update public.recipes set yield_quantity = NULL where recipe_code = 'SAU-016';
update public.recipes set yield_quantity = 50 where recipe_code = 'DIP-004';
update public.recipes set yield_quantity = 50 where recipe_code = 'DIP-005';
update public.recipes set yield_quantity = NULL where recipe_code = 'PUE-010';
update public.recipes set yield_quantity = NULL where recipe_code = 'GEM-007';
update public.recipes set yield_quantity = NULL where recipe_code = 'GEM-008';
update public.recipes set yield_quantity = NULL where recipe_code = 'GEM-016';
update public.recipes set yield_quantity = NULL where recipe_code = 'FRU-002';

notify pgrst, 'reload schema';