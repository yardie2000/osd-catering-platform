-- Rollback for renames.sql.

update public.ingredients set name = 'Cashew praline 500' where id = '941b99d2-3265-44c9-b734-cf1231c2ef1f';
update public.ingredients set name = 'Hafer milch 700' where id = '90a670b3-3453-409e-9664-5996b3c820e2';
update public.ingredients set name = 'Mais starci 60' where id = '30eb1319-2085-4921-b1fe-ea4eddc31337';

notify pgrst, 'reload schema';