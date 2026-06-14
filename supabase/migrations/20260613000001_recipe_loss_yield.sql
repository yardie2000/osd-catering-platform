-- ============================================================
-- OSD Catering Platform V4.2 — Production-loss & yield per recipe
-- Migration: 20260613000001_recipe_loss_yield
--
-- The V4.2 calculation engine implements the kitchen formula:
--   Required   = portionQty × PAX
--   Production = Required   × (1 + production_loss_pct/100)
--   Purchasing = Production ÷ (yield_pct/100)
--
-- production_loss_pct and yield_pct are PER-RECIPE OVERRIDES. They are
-- nullable: NULL means "use the application's global default" (10 % loss /
-- 80 % yield, see lib/purchasing/aggregate.ts#DEFAULT_CALC_CONFIG). This keeps
-- Option 1 (global defaults, per-recipe overridable) — no mass backfill needed.
--
-- Idempotent. Additive only. Historical migrations are never edited.
-- ============================================================

alter table public.recipes
  add column if not exists production_loss_pct numeric(5,2),
  add column if not exists yield_pct           numeric(5,2);

-- Sanity guards (defensive; ignore if they already exist).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recipes_production_loss_pct_chk') then
    alter table public.recipes
      add constraint recipes_production_loss_pct_chk
      check (production_loss_pct is null or (production_loss_pct >= 0 and production_loss_pct <= 100));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recipes_yield_pct_chk') then
    alter table public.recipes
      add constraint recipes_yield_pct_chk
      check (yield_pct is null or (yield_pct > 0 and yield_pct <= 100));
  end if;
end $$;

comment on column public.recipes.production_loss_pct is
  'V4.2: production loss % override (NULL = global default). Production = Required × (1 + pct/100).';
comment on column public.recipes.yield_pct is
  'V4.2: usable yield % override (NULL = global default). Purchasing = Production ÷ (pct/100).';

notify pgrst, 'reload schema';
