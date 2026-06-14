-- V4.2 cosmetic ingredient renames (strip pack-size numbers from name).

update public.ingredients set name = 'Cashew praline' where id = '941b99d2-3265-44c9-b734-cf1231c2ef1f';  -- was "Cashew praline 500"
update public.ingredients set name = 'Hafermilch' where id = '90a670b3-3453-409e-9664-5996b3c820e2';  -- was "Hafer milch 700"
update public.ingredients set name = 'Maisstärke' where id = '30eb1319-2085-4921-b1fe-ea4eddc31337';  -- was "Mais starci 60"

notify pgrst, 'reload schema';