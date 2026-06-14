-- ============================================================
-- V3 — Kolli (packaging) fields on recipe_ingredients
-- Migration: 20260601000003_recipe_ingredients_kolli
-- ============================================================

ALTER TABLE public.recipe_ingredients
  ADD COLUMN IF NOT EXISTS package_qty  NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS package_unit TEXT;

COMMENT ON COLUMN public.recipe_ingredients.package_qty  IS 'Packaging quantity per order unit (Kolli), e.g. 24';
COMMENT ON COLUMN public.recipe_ingredients.package_unit IS 'Packaging unit description, e.g. Karton, Kiste, Sack';
