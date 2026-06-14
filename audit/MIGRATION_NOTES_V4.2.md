# V4.2 Migration Notes

## 1. Schema migration (required)

Run in the Supabase **SQL editor** (PostgREST JWTs can't do DDL; `supabase db push`
is discouraged here — see spec §6):

```
supabase/migrations/20260613000001_recipe_loss_yield.sql
```

Adds `recipes.production_loss_pct` and `recipes.yield_pct` (both `numeric(5,2)`,
nullable, 0–100 checked). Idempotent. Ends with `notify pgrst, 'reload schema'`.
**No data is changed** — every recipe keeps `NULL`, meaning "use the global default"
(10 % loss / 80 % yield). Override individual recipes later as the chef confirms values.

No rollback needed (additive). To revert: `alter table public.recipes drop column if
exists production_loss_pct, drop column if exists yield_pct;`.

## 2. Application behaviour after migration

- Production Output now shows **production quantity** (= required × 1.10 by default).
- Purchasing Output now shows **purchasing quantity** (= production ÷ 0.80 by default)
  for mass/volume; physical totals rise ×1.375 vs V4.1. Verified on the juni batch
  (`node audit/corrected_juni.cjs`): Σ physical 121 501 → 167 065 (g+ml).
- Qualitative units (`Geschmack`, `Bedarf`, …) are no longer inflated; the UI should
  render `unit_class === 'qualitative'` as **"n. Bedarf"**.

Global defaults live in `lib/purchasing/aggregate.ts#DEFAULT_CALC_CONFIG`. To change them
platform-wide, edit there (later: surface in Settings).

## 3. Recommended data step — re-import corrected recipes (optional but high-impact)

The corrected workbook `OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx` carries
portion bases for **21 recipes**; importing it via the Import Center will:
- Fix wrong bases already in the live DB (e.g. **Caesar-Dressing 200 → 45 portions**,
  a +344 % correction to that recipe's quantities).
- Populate `yield_quantity` for those 21 (the importer parses "N Portionen").

**Caveat:** 65 recipes (incl. every `REC-00xx` used in the juni batch: Alioli, Brisket
Rub, Cashew creme, Focaccia, Beetroots Gel, …) have **no** portion base in the workbook
and will continue to use the global default base (50). To make their absolute numbers
trustworthy, a yield must be entered per recipe. Coverage table: `audit/recipe_yields.csv`.

`parseYieldString` now ignores non-portion yields (e.g. "Ca. 400 g", "180–220 ml") so a
mass/volume yield is never mistaken for a portion count.

## 4. Verification checklist

```bash
npm run type-check   # clean
npm test             # 10/10 (node --test, incl. Phase-3 example)
npm run build        # 17 routes OK
node audit/reconcile.mjs        # aggregation still 0 mismatches
node audit/corrected_juni.cjs   # corrected real-batch numbers
```
