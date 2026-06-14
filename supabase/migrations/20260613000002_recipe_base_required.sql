-- ============================================================
-- OSD Catering Platform V4.5 — Rezeptbasis: base_portions
-- Migration: 20260613000002_recipe_base_required
--
-- Adds the canonical V4.5 base field `base_portions` (Basisportionen:
-- Anzahl Portionen, die ein Rezept standardmäßig abbildet).
--
-- The column stays NULLABLE at the DB level: the application enforces it as a
-- required field (Zod in components/recipes/recipe-form.tsx). This keeps the
-- Option-1 philosophy of 20260613000001 (global defaults, no forced mass
-- backfill) and avoids breaking the Excel importer, which does not supply a
-- base portion. DB-level NOT NULL enforcement is deferred (see V4.5 spec).
--
-- Idempotent. Additive only. Uses the REAL snake_case columns
-- (recipes.yield_quantity / recipes.yield_unit_id), not legacy camelCase.
-- ============================================================

alter table public.recipes
  add column if not exists base_portions numeric(12,3);

-- Sanity guard (defensive; ignore if it already exists).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_base_portions_chk') then
    alter table public.recipes
      add constraint recipes_base_portions_chk
      check (base_portions is null or base_portions > 0);
  end if;
end $$;

comment on column public.recipes.base_portions is
  'V4.5: Basisportionen — Anzahl Portionen, die das Rezept standardmäßig abbildet (NULL = noch nicht erfasst; App erzwingt Pflicht).';

notify pgrst, 'reload schema';
