-- ============================================================
-- OSD Catering Platform V3 — Restore missing foreign keys
-- Migration: 20260603000002_v3_foreign_keys
--
-- The live database has the right columns and data but is
-- MISSING several foreign-key constraints. PostgREST needs
-- those FKs to resolve embedded joins (e.g.
--   ingredients?select=*,default_unit:units(*)
--   menus?select=*,menu_items(*)
-- ); without them those requests fail with HTTP 400.
--
-- This migration adds the FKs that the existing columns
-- legitimately imply. It is IDEMPOTENT (safe to re-run):
--   * every FK is guarded — re-running skips ones already present
--   * tables / columns are checked before use, so missing
--     optional tables (e.g. supplier_products) are skipped, not errored
--   * orphan rows (child values absent from the parent) are
--     nulled out first WHERE THE COLUMN IS NULLABLE, so the
--     constraint can be added cleanly
--
-- NOTE: We intentionally DO NOT add menu_items -> recipes.
-- The live menu_items table has no recipe_id column; menu items
-- are standalone rows (name, description, dietary, item_price).
-- ============================================================

-- ── temporary helper ─────────────────────────────────────────
-- Adds one FK guarded for idempotency + existence + orphans.
CREATE OR REPLACE FUNCTION public._v3_add_fk(
  p_child   text,   -- child (referencing) table
  p_col     text,   -- child *_id column
  p_parent  text,   -- parent (referenced) table; always references its id
  p_action  text    -- ON DELETE action: 'CASCADE' | 'SET NULL' | 'RESTRICT'
) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  v_constraint text := p_child || '_' || p_col || '_fkey';
  v_nullable   text;
BEGIN
  -- child table + column must exist
  SELECT is_nullable INTO v_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_child AND column_name = p_col;
  IF v_nullable IS NULL THEN
    RAISE NOTICE 'skip % : child column %.% does not exist', v_constraint, p_child, p_col;
    RETURN;
  END IF;

  -- parent table must exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = p_parent
  ) THEN
    RAISE NOTICE 'skip % : parent table % does not exist', v_constraint, p_parent;
    RETURN;
  END IF;

  -- already constrained? -> nothing to do (idempotent re-run)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = p_child
      AND constraint_name = v_constraint
  ) THEN
    RAISE NOTICE 'skip % : constraint already present', v_constraint;
    RETURN;
  END IF;

  -- null out orphan rows so the constraint will not fail.
  -- Only possible when the column allows NULL; a NOT NULL column
  -- with orphans is a genuine data problem and will surface below.
  IF v_nullable = 'YES' THEN
    EXECUTE format(
      'UPDATE public.%I SET %I = NULL
         WHERE %I IS NOT NULL
           AND %I NOT IN (SELECT id FROM public.%I)',
      p_child, p_col, p_col, p_col, p_parent
    );
  END IF;

  -- add the foreign key (named exactly <child>_<col>_fkey so the
  -- app''s PostgREST embed hints and TS Relationships resolve)
  EXECUTE format(
    'ALTER TABLE public.%I
       ADD CONSTRAINT %I FOREIGN KEY (%I)
       REFERENCES public.%I (id) ON DELETE %s',
    p_child, v_constraint, p_col, p_parent, p_action
  );
  RAISE NOTICE 'added constraint %', v_constraint;
END;
$fn$;

-- ── add the foreign keys the schema implies ──────────────────
-- master data
SELECT public._v3_add_fk('ingredients',        'default_unit_id', 'units',       'SET NULL');
SELECT public._v3_add_fk('recipes',            'yield_unit_id',   'units',       'SET NULL');

-- recipe lines
SELECT public._v3_add_fk('recipe_ingredients', 'recipe_id',       'recipes',     'CASCADE');
SELECT public._v3_add_fk('recipe_ingredients', 'ingredient_id',   'ingredients', 'RESTRICT');
SELECT public._v3_add_fk('recipe_ingredients', 'unit_id',         'units',       'RESTRICT');

-- menu lines (the one that unblocks the menu detail embed)
SELECT public._v3_add_fk('menu_items',         'menu_id',         'menus',       'CASCADE');

-- supplier + import audit (skipped automatically if tables absent)
SELECT public._v3_add_fk('supplier_products',  'ingredient_id',   'ingredients', 'CASCADE');
SELECT public._v3_add_fk('data_import_log',    'import_job_id',   'import_jobs', 'CASCADE');

-- ── clean up helper ──────────────────────────────────────────
DROP FUNCTION public._v3_add_fk(text, text, text, text);

-- ── ask PostgREST (Supabase API) to reload its schema cache ──
-- so the new relationships are immediately usable by embeds.
NOTIFY pgrst, 'reload schema';
