# OSD Catering Platform — V4.1 Error Analysis (Phase 2 & 3)

Companion to [`AUDIT_REPORT.md`](AUDIT_REPORT.md). All "Actual" numbers are the real
exported values of the **juni** batch (`output/produktion_juni.csv`,
`output/einkauf_juni.csv`); every one reconciles to the gram (`audit/reconcile.mjs`).
"Expected" is the Phase-3 reference model. Where the brief's own worked example supplies
loss/yield (10 % / 80 %), it is used; per-ingredient loss/yield are **not invented**
(the brief forbids mock numbers) — instead the *missing multiplier* is named explicitly.

---

## Batch under trace

`juni` — 3 menus, 495 pax:

| Menu | Code | Pax |
|---|---|---|
| ABENDMENÜ | MENU_ABENDMENU_2026 | 175 |
| BBQ MENÜ | MENU_BBQ_2026 | 140 |
| FINGERFOOD ABENDS | MENU_FINGERFOOD_2026 | 180 |

---

## PHASE 2 — Trace: Menu → Recipe → Ingredient → Batch → Purchasing

### Trace A — clean metric ingredient (pipeline is internally correct)

**Salt** (ING-0115), via 3 recipes in 2 menus:

| Step | Recipe | Menu(s) | portions_needed | base | factor | recipe qty | scaled |
|---|---|---|---|---|---|---|---|
| Production | Alioli REC-0022 | ABEND+BBQ | 315 | 50 | ×6,3 | 3,0 g | 18,9 g |
| Production | Brisket Rub REC-0023 | BBQ | 140 | 50 | ×2,8 | 60,0 g | 168,0 g |
| Production | Focaccia REC-0018 | ABEND+BBQ | 315 | 50 | ×6,3 | 10,0 g | 63,0 g |
| **Purchasing** | merged | — | — | — | — | — | **249,9 g** |

Expected (aggregation) = 18,9 + 168 + 63 = **249,9 g** → Actual = **249,9 g** → **Δ 0 / 0 %**.
✅ Menu→Recipe→Ingredient→Batch→Purchasing aggregation is exact.

### Trace B — the Phase-3 multipliers that are missing

Same Salt line, now against the full Phase-3 model (using the brief's 10 %/80 %):

| Quantity | Formula | Expected | Actual (V4.1) | Δ | Error % |
|---|---|---|---|---|---|
| Required | Σ recipe demand | 249,9 g | 249,9 g | 0 | 0 % |
| Production | Required × 1,10 | **274,9 g** | 249,9 g | −25,0 g | **−9,1 %** |
| Purchasing | Production ÷ 0,80 | **343,6 g** | 249,9 g | −93,7 g | **−27,3 %** |

The −9,1 % / −27,3 % gap is **structural** (no loss stage, no yield stage) and applies to
**every** physical ingredient, not just Salt — see the spec worked example
(15 kg → 16,5 kg → 20,625 kg) reproduced by `audit/formula_gap.mjs`.

### Trace C — the guessed-base error (scaling factor is unreliable)

**Alioli** REC-0022, 315 portions, **base assumed = 50** (no `yield_quantity`, no parsable note):

| Ingredient | recipe qty (for base 50) | scaled ×6,3 | per-portion implied |
|---|---|---|---|
| Egg Yolk | 20 g | 126 g | 0,40 g/Portion |
| Raps Oil | 150 ml | 945 ml | 3,0 ml/Portion |

0,4 g of egg yolk and 3 ml of oil **per portion of aioli** is not a real recipe — it
implies the recipe was entered for ~6–8 portions, not 50. With `base = 50` the output is
~**6–8× too low**. This cannot be proven without the recipe's true base (DB/chef), but it
is the direct, visible symptom of E3: 73 of 83 recipes fall back to the literal constant
`DEFAULT_BASE_PORTIONS = 50`.

### Trace D — placeholder unit becomes a nonsense purchase line

**Salz** (ING-0010) "to taste" across 11 recipes → purchasing row **`Salz 37,22 Geschmack`**
(0,9+3,27+2,8+3,6+3,6+7+3,5+2,1+2,8+2,8+4,85). "Buy 37,22 *to-taste* of salt" is not an
orderable quantity, and it does **not** merge with the real `Salz 28 g` line → **two rows
for one ingredient** (E4).

---

## PHASE 2 — Error classification (the brief's 8 categories)

| Category | Present? | Evidence / instance |
|---|---|---|
| **Duplicated calculations** | **No** (good) | Production & Purchasing share `resolveBase`/scaling via `computeBatchOutputs`; they cannot diverge. Reconciliation = 0 mismatches. |
| **Missing multipliers** | **Yes — E1, E2** | `×(1+loss%)` and `÷yield%` absent from code *and* schema. |
| **Incorrect scaling factors** | **Yes — E3** | `base` guessed at 50 for 73/83 recipes; bases inconsistent (45/50/55/65/150/200). |
| **Rounding errors** | **Display only — E6** | Internal math is full-precision; the *factor* is shown rounded (`×3,27`) while `3.2727…` is applied → `9.818,18 g`. No accumulation error. |
| **Unit conversion errors** | **Metric: No** / **Placeholder: E4** | kg→g, l→ml verified correct (0 mismatches). Non-metric placeholders not convertible. |
| **Menu mapping errors** | **Latent** | Unlinked `menu_items` (recipe_id NULL) silently contribute nothing (warned, not failed). No double-count (per-menu `seen` dedup verified). |
| **Recipe mapping errors** | **Latent** | Recipes with 0 ingredients (Croquetas, Maiskolben, Schokomousse, Tramezzini, Pickled Water) scale but emit nothing — warned only. |
| **Batch aggregation errors** | **No** | 86/86 purchasing rows reconcile exactly to re-aggregated production. |

---

## PHASE 3 — Formula verification result

| Phase-3 rule | Implemented in V4.1? | Where it should live |
|---|---|---|
| `Required = PortionQty × PAX` | **Partial** — as `recipeQty × pax/base`, base guessed | per-portion qty on `recipe_ingredients`, or a reliable `yield_quantity` on every recipe |
| `Production = Required × (1+loss%)` | **No** | new `recipes.production_loss_pct` (or per-ingredient) |
| `Production Factor = 1 + loss%` | **No** | derived |
| `Purchasing = Production ÷ yield%` | **No** (forced `= Production`) | new `recipe_ingredients.yield_pct` (or per-ingredient default) |

---

## Root-cause → fix map (for V4.2)

| ID | Defect | Root cause | Fix direction (V4.2) |
|---|---|---|---|
| **E1** | No production-loss factor | feature never built; no column | add `production_loss_pct`; `production = required × (1 + loss/100)` |
| **E2** | Purchasing = Production | §21 forces equality; no yield column | add `yield_pct`; `purchasing = production ÷ (yield/100)` |
| **E3** | Guessed base 50 | most recipes lack structured `yield_quantity` | make portion basis explicit & required; flag every assumed recipe; ideally store per-portion quantities |
| **E4** | Placeholder units scaled/merged wrong | "Geschmack/Bedarf" stored in `unit_id` | mark non-physical units `is_physical=false`; exclude from purchasing totals, list as "n. Bedarf" |
| **E5** | Duplicate/dirty ingredients | master-data hygiene | de-dupe ingredients; strip embedded amounts from names; merge `Salt/Salz`, `Olive Oil/Olivenöl` |
| **E6** | Ugly decimal tails | display rounds factor not value; no pack rounding | round to sensible precision; optionally round purchasing up to pack size |
| **E7** | L vs ml display mismatch | production keeps raw unit, purchasing canonicalizes | choose one canonical display for both outputs |
| **E8** | Dead legacy tables | pre-V4.1 persistence left in place | drop from `Database` type / document as deprecated |

> **Engineering note (must not be lost in V4.2):** the *single shared scaler* in
> `computeBatchOutputs` is the correct architecture — production and purchasing derive
> from one basis and reconcile exactly. The fix must **extend** this shared path with the
> loss/yield stages, **not** fork it. Forking would re-introduce the divergence risk V4.1
> deliberately removed.
