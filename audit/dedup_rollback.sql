-- Rollback for dedup_merge.sql — re-creates the dropped ingredients and re-points the
-- exact recipe_ingredient rows back to them (captured pre-merge). Run as one transaction.
begin;

insert into public.ingredients (id, ingredient_code, name) values ('679adcee-b56c-4093-90f6-931878f47b18', 'ING-0168', 'sugar') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = '679adcee-b56c-4093-90f6-931878f47b18' where id in ('ef1ff0a5-fa0c-4538-b6f0-d5ed39fc886a');
insert into public.ingredients (id, ingredient_code, name) values ('3f815294-164d-4b34-b10b-bbcbb64bb2c4', 'ING-0115', 'Salt') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = '3f815294-164d-4b34-b10b-bbcbb64bb2c4' where id in ('a58b1083-8a4d-425d-8cf8-5ab6cb2f4367', '096017e0-5f36-4842-838d-e67e6fa8ef3b', 'cee1999e-5051-4b99-921e-b588a0559a67', '90b47f25-bc95-40f0-9e03-a1409c550029', '07b49819-307b-4f7d-bdf0-525e6fbe5ae7', '8b124af6-1a25-42d5-b828-bdeb962d6db2', '7e13c304-4ab7-4331-aab5-95aab930f673', '0c12c55a-e01f-4b8e-9a4c-859c5f3b737e', '970775f9-093e-4168-9913-b06e8ea8ca25', '5353a3ea-9a7f-45d4-8dd5-6dd540fab6bc', 'c602753e-392a-4bfc-aaae-bc695337575b');
insert into public.ingredients (id, ingredient_code, name) values ('bc6c151d-bb11-4d96-ba39-0710c6c72a25', 'ING-0167', 'SALT 2 g Cashew praline') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = 'bc6c151d-bb11-4d96-ba39-0710c6c72a25' where id in ('0419f8ea-9d28-481c-b554-853e0be7b1c1');
insert into public.ingredients (id, ingredient_code, name) values ('c29b7a0f-23ae-4dcf-a1ef-8941d411d3a3', 'ING-0138', 'Olive Oil') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = 'c29b7a0f-23ae-4dcf-a1ef-8941d411d3a3' where id in ('a324d57e-b656-4c11-814c-4c0702789c18');
insert into public.ingredients (id, ingredient_code, name) values ('52ad235a-358e-4e4a-9b37-d81f77327989', 'ING-0147', 'Lemon Juice') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = '52ad235a-358e-4e4a-9b37-d81f77327989' where id in ('fc2e829b-7b83-4a91-a90d-76eb42631513');
insert into public.ingredients (id, ingredient_code, name) values ('dfde793a-358f-4229-805a-7006bd5871f2', 'ING-0148', 'Mustard') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = 'dfde793a-358f-4229-805a-7006bd5871f2' where id in ('72173212-2708-4906-9931-466d34aa3b8f');
insert into public.ingredients (id, ingredient_code, name) values ('cb812cc5-f2c3-450f-ae47-c2f54829523f', 'ING-0101', 'H2O') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = 'cb812cc5-f2c3-450f-ae47-c2f54829523f' where id in ('42cfbc84-0f8d-4976-a0bf-7c3f3ab931a2', '011d4d38-3087-4e5d-b121-beb657818508', '5b97d868-e75a-43ed-b779-d921034fa791', 'e5cc9039-d50f-41ad-8da6-d3d7540f3a0e', '1958dbc2-0bde-4c9d-a969-a25cd7f67459', '51a26437-8b9a-418c-8545-752f20bf3cdb', '780badc4-8459-4d92-9ee4-b055e97d888b', 'b434bffa-d6cf-41e8-bd56-9dc3566d86d7', '8ad3d9dc-8c6c-4161-b2bb-90f541a6c3d9');
insert into public.ingredients (id, ingredient_code, name) values ('513a1b03-c3f6-4dd0-a986-7c9486027ab3', 'ING-0169', 'water (on500 gr Cashew)') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = '513a1b03-c3f6-4dd0-a986-7c9486027ab3' where id in ('09258edb-7536-4f7e-bf23-b92a1bd21fc9');
insert into public.ingredients (id, ingredient_code, name) values ('12e31c8d-4a2e-403d-ae63-81a7cd21b54a', 'ING-0112', 'Egg Yolk') on conflict (id) do nothing;
update public.recipe_ingredients set ingredient_id = '12e31c8d-4a2e-403d-ae63-81a7cd21b54a' where id in ('65222fe2-1e63-4ab5-9646-2268a70dc54a', '6a966471-ac8b-4d9a-bb6b-2ffcefa62962', 'c6cac56b-4ac8-4626-ac24-003602a7ac30');

commit;
notify pgrst, 'reload schema';