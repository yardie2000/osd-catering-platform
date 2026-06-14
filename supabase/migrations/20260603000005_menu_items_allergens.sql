-- ============================================================
-- OSD Catering Platform V3 — menu_items allergens
-- Migration: 20260603000005_menu_items_allergens
--
-- Adds an allergens column to menu_items (same shape as
-- ingredients.allergens: a text[] of German allergen names).
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
