# OSD Catering Platform — V4.1 Calculation Audit (pre-V4.2)

**Date:** 2026-06-13 · **Scope:** full calculation engine, DB schema, output UIs
**Source of truth:** `output/produktion_juni.csv`, `output/einkauf_juni.csv`, `output/*.pdf`
(the real exported output of the **„juni"** batch — 3 menus, 495 pax) + the Phase-3
formula spec in the task brief.
**Method:** static code reading + two deterministic scripts
(`audit/reconcile.mjs`, `audit/formula_gap.mjs`) run against the real exports. No DB
writes, no engine changes were made for this audit.

> **Headline:** The aggregation/merge layer is **provably correct** (86/86 purchasing
> rows reconcile exactly to re-aggregated production; kg→g and l→ml conversions are
> right). The defects are **upstream of aggregation** (two whole formula stages are
> missing, and the per-recipe scaling base is *guessed*) and in **data quality**
> (placeholder units, duplicate ingredients). The numbers are internally consistent
> but they answer the wrong formula.

---

## PHASE 1 — System analysis: every calculation path

The entire engine is **three pure functions** behind one orchestrator, fed by two read
services. There is exactly **one** scaling model and **one** aggregation routine — there
is no hidden second calculator.

| # | File · function | Inputs | Output | Formula | Depends on |
|---|---|---|---|---|---|
| 1 | [`lib/operations/computeBatchOutputs.ts`](../lib/operations/computeBatchOutputs.ts) `computeBatchOutputs` | `rows:[{menu,count}]`, `units[]`, `supplierProducts[]`, `defaultBasePortions=50` | `{production, purchasing}` | delegates to #2 and #3 with the **same** rows | #2, #3 |
| 2 | [`lib/production/plan.ts`](../lib/production/plan.ts) `buildProductionPlan` | `rows`, `defaultBasePortions` | `ProductionPlanResult{batches,warnings,assumptions}` | `portions_needed = Σ count` over menus containing the recipe; `scale = portions_needed / base`; `ing.qty = recipe_ingredient.quantity × scale` | #4 |
| 3 | [`lib/purchasing/aggregate.ts`](../lib/purchasing/aggregate.ts) `aggregatePurchasing` | `rows`, `supplierProducts`, `defaultBasePortions`, `units` | `PurchasingResult{lines,warnings,assumptions,totalCost}` | per menu line: `scale = count / base`; `add = qty × scale × canonFactor`; aggregate by `(ingredient_id, canonicalUnit)` | #4, #5, #6, #7 |
| 4 | `aggregate.ts` `resolveBase` | `recipe`, `fallback` | `{base, source}` | `yield_quantity>0 ? yield : (parseBasePortions(notes) ?? fallback)` | #5 |
| 5 | `aggregate.ts` `parseBasePortions` | `production_notes` | `number\|null` | regex `(\d+)(–\d+)? Portionen` → range midpoint, else single value | — |
| 6 | `aggregate.ts` `canonicalize` | `unit`, `unitId`, `baseByCode` | `{key,unitId,unit,factor}` | `g\|kg→ key b:g` (×1000 if kg); `l\|ml→ key b:ml` (×1000 if l); else `u:<id>` ×1 | — |
| 7 | `aggregate.ts` `resolveSupplier` | `supplierProducts[]`, `unit` | `{supplier_name,unit_price,alternatives}` | cheapest unit-matching pack → `pack_price / pack_qty` | — |
| 8 | [`services/batch.service.ts`](../services/batch.service.ts) `getOutputs` | `batchId` | `BatchOutputsResult` | loads items→menus→supplierProducts→units, calls #1 | #1, #9 |
| 9 | [`services/purchasing.service.ts`](../services/purchasing.service.ts) `getMenusForCalc` | `menuIds[]` | `CalcMenu[]` | PostgREST deep embed `menus → menu_items → recipe → recipe_ingredients → ingredient/unit` | — |

### Answers to the 10 required inventory items

1. **Quantity calculation services** — only `computeBatchOutputs` (orchestrator) +
   `buildProductionPlan` + `aggregatePurchasing`. `batch.service.getOutputs` is the data loader.
2. **Recipe scaling logic** — `scale = count / base` (rows #2, #3). Identical in both paths.
3. **Menu scaling logic** — none beyond pax. A menu contributes its pax to **every** linked
   recipe once (`buildProductionPlan` dedups recipes per menu via a `seen` set).
4. **Production batch calculations** — `buildProductionPlan`: one batch **per recipe**,
   `portions_needed = Σ pax` of menus containing it, ingredients scaled by `portions_needed/base`.
5. **Purchasing list calculations** — `aggregatePurchasing`: same scaling, then summed across
   all recipes/menus by `(ingredient, canonical unit)`.
6. **Ingredient aggregation logic** — `Map` keyed `${ingredient_id}::${canonKey}` (row #3).
   **Verified correct** (see Phase 5/6).
7. **Yield calculations** — **MISSING as a concept.** `recipes.yield_quantity` is consumed
   only as the *portion base* (a denominator), **not** as a yield ratio. No `÷ yield%` step exists.
8. **Waste / shrinkage calculations** — **ABSENT.** No field, no code, anywhere.
9. **Menu → Recipe mappings** — `menu_items.recipe_id` (nullable FK `menu_items_recipe_id_fkey`,
   `ON DELETE SET NULL`). Unlinked lines are skipped with a `no_recipe` warning.
10. **Recipe → Ingredient mappings** — `recipe_ingredients` (qty + unit_id per ingredient).

---

## PHASE 3 — Core-formula verification (engine vs required)

Required model (task brief):

```
Required   = PortionQty × PAX
Production = Required × (1 + ProductionLoss%)      ← Production Factor
Purchasing = Production ÷ Yield%
```

Worked example from the brief, reproduced by `audit/formula_gap.mjs`:

| Stage | Phase-3 reference | Current V4.1 | Error |
|---|---|---|---|
| Required | 100 × 150 g = **15 000 g** | `qty × pax/base` (= 15 000 g only if base is exact) | depends on base |
| Production (×1.10) | **16 500 g** | 15 000 g — *no loss factor* | **−9.1 %** |
| Purchasing (÷0.80) | **20 625 g** | 15 000 g — *no yield division* | **−27.3 %** |

**Verdict:** the V4.1 engine implements only the first stage (`Required`), and even that
through a **guessed `base`** rather than a true per-portion quantity. The `Production
Factor` and `Yield` stages do not exist in code **or in the schema**. By design
(`DEFAULT_BASE_PORTIONS = 50`, see `computeBatchOutputs.ts:12` and §21 of the spec)
**Purchasing is forced equal to Production** — which is exactly the opposite of the
Phase-3 requirement that purchasing must be *larger* than production by `1/yield`.

---

## PHASE 4 — Database consistency check

Schema verified from `types/database.ts` + `supabase/migrations/*` (the live DB is the
authority per the spec; these are the structural facts).

| Table | FKs / relations | Finding |
|---|---|---|
| `menus` | — | OK |
| `menu_items` | `menu_id`→menus (CASCADE), `recipe_id`→recipes (SET NULL, **nullable**) | OK. **No `unique(menu_id,recipe_id)`** by design (a dish may repeat). |
| `recipes` | `yield_unit_id`→units (SET NULL) | `yield_quantity` present but **semantically overloaded** (used as portion base). **No `production_loss`, no `yield_pct`** columns. |
| `recipe_ingredients` | `recipe_id`/`ingredient_id`/`unit_id` all FK'd | OK. `quantity` has `CHECK (quantity > 0)` — so "to taste" lines are stored as `1` of a placeholder unit. **No per-ingredient yield/waste.** |
| `ingredients` | `default_unit_id`→units | `category` empty → all purchasing rows fall in „Ohne Kategorie". **Duplicate concepts** exist as separate ingredient rows (see Phase 5). |
| `units` | — | `base_unit` / `conversion_factor` columns exist but are **all NULL** → conversions are hard-coded in `canonicalize` (g/kg, ml/l only). |
| `production_batches` | `recipe_id`,`unit_id`,`event_id` FK'd | **LEGACY / unused** by V4.1 flow. Per-recipe schema, not wired to `kitchen_batches`. |
| `purchasing_lists` / `_items` | FK'd incl. `event_id`,`supplier_id` | **LEGACY / unused.** No data written by V4.1. |
| `kitchen_batches` / `kitchen_batch_items` | `batch_id`→CASCADE, `menu_id`→RESTRICT, `unique(batch_id,menu_id)` | OK — this is the real V4.1 input. |

**No broken FKs. No incorrect joins.** The inconsistencies are:
- **C1 — Missing columns** for the required formula: `production_loss_pct`, `yield_pct`
  (and arguably an `is_scalable`/placeholder flag for seasonings). Phase-3 cannot be
  implemented on the current schema without a migration.
- **C2 — Overloaded `yield_quantity`** — means "portions this recipe makes", not a yield
  ratio. The name invites the exact confusion that Phase 3 warns about.
- **C3 — Two dead persistence stacks** (`production_batches`, `purchasing_lists*`) still
  in the `Database` type and DB — pure noise, a trap for future maintainers.
- **C4 — No unit dimension table data** (`conversion_factor` NULL) — every non-metric
  unit is un-convertible; placeholder "units" live in the same column as real ones.

---

## PHASE 5 & 6 — Aggregation + purchasing validation (deterministic)

`audit/reconcile.mjs` re-aggregates the **exported production CSV** by
`(ingredient, canonical unit)` — applying kg→g and l→ml exactly as the app claims — and
diffs against the **exported purchasing CSV**:

```
production ingredient lines parsed : 112
re-aggregated (ingredient,unit) keys: 86
purchasing rows                     : 86
matches within ±0.05                : 86
MISMATCHES                          : 0
only in production                  : 0
only in purchasing                  : 0
```

**Conclusion (Phase 6 requirement "purchasing totals must match production totals"):
SATISFIED.** Worked examples that reconcile to the gram:

- **Petersilie** = Chimichurri 560 g + Linsensalat 350 g = **910 g** ✓
- **Essig** = Chimichurri 420 ml + Zitrus-Dressing 1 386 ml = **1 806 ml** ✓
- **Salt (ING-0115)** = Alioli 18,9 + Brisket 168 + Focaccia 63 = **249,9 g** ✓
- **Butter** = Gemüsepüree 700 g + Beurre Blanc 1 750 g = **2 450 g** ✓
- **Beetroots Juice**: production shows **3,5 L**, purchasing shows **3 500 ml** — same
  quantity, correct l→ml. (Display differs: see E7.)

This is the **Menu A: X=5kg + X=2kg ⇒ 7kg** scenario from Phase 5 — it works.

### But aggregation is **fragmented** for 4 ingredients (real defect E4)

```
Zitronensaft : Geschmack | ml
Wasser       : Bedarf | ml | Geschmack
Salz         : Geschmack | g
Olivenöl     : Bedarf | Geschmack
```

These produce **multiple purchasing rows for one ingredient** (e.g. `Salz 37,22 Geschmack`
*and* `Salz 28 g`). The aggregator is behaving correctly given the data — the cause is
**placeholder units** ("Geschmack" = to taste, "Bedarf" = as needed) being treated as
physical, non-mergeable units. This violates Phase 6's "identical ingredients must be merged".

---

## What is actually wrong (ranked) — detail in `ERROR_ANALYSIS.md`

1. **E1 — No Production-Loss stage** (Phase 3 `×(1+loss%)` absent). Severity: **Critical**.
2. **E2 — No Yield stage; Purchasing ≡ Production** (Phase 3 `÷yield%` absent; under-buys). **Critical**.
3. **E3 — Guessed portion base (default 50)** for 73/83 recipes → untrustworthy absolute
   quantities; bases range 45/50/55/65/150/200 with no structured source. **Critical**.
4. **E4 — Placeholder units** ("Geschmack/Bedarf/5-10Gr") scaled as quantities & fragmenting
   aggregation. **High**.
5. **E5 — Duplicate / dirty ingredient master**: `Salt`(ING-0115) vs `Salz`(ING-0010),
   `Olive Oil`(ING-0138) vs `Olivenöl`(ING-0009); names with embedded amounts
   (`Cashew praline 500`, `Hafer milch 700`, `Mais starci 60`, `water (on500 gr Cashew)`,
   `SALT 2 g Cashew praline`). Prevents correct merge. **High** (data).
6. **E6 — Display rounding**: factor printed `×3,27` but applied `3.2727…` → ugly tails like
   `9.818,18 g`, `16.961,54 g` on a purchase order. **Medium**.
7. **E7 — Production vs Purchasing unit display inconsistency** (L kept in production,
   normalized to ml in purchasing). Same value; confuses the kitchen. **Low**.
8. **E8 — Two legacy persistence stacks** (`production_batches`, `purchasing_lists*`) dead
   but still typed/in-DB. **Low** (hygiene).

---

## Reproducing this audit

```bash
node audit/reconcile.mjs     # Phase 5/6 — aggregation reconciliation (0 mismatches, 4 fragmented)
node audit/formula_gap.mjs   # Phase 3 — formula gap (−9.1% prod, −27.3% purchasing)
```
