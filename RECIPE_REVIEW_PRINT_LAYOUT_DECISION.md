# Recipe Review Print / PDF — Layout Decision

**Feature:** English-language print/PDF review document so the (English-speaking) head
chef can review all ~87 recipes on paper and mark corrections by hand.

## Chosen layout: Hybrid

Three variants were considered:

1. **Compact Review Sheet** — maximum recipes per page. Rejected: too little room for the
   correction fields the chef needs; ingredient tables become unreadable.
2. **Detailed Recipe Sheet** — one lavish page per recipe. Rejected: ~87 recipes would
   produce a bloated document with large empty areas; no fast overview.
3. **Hybrid** — cover + compact index + per-recipe review blocks that flow naturally.
   **Chosen.** Gives a fast overview (index) *and* enough per-recipe correction space
   without wasting paper. Matches the requested structure.

### Document structure

1. **Cover page** — "OSD Catering — Recipe Review", print date, recipe count, and a short
   instruction line for the chef. Own page (`break-after: page`).
2. **Recipe Index** — one compact table of all recipes: No., Recipe, Category, Base
   portions, Yield, Status, Notes. `Status` flags recipes with missing/incomplete data so
   the chef can triage. Own page.
3. **Recipe Review Blocks** — one block per recipe, flowing 1–2 per page. Each block uses
   `break-inside: avoid` so a recipe is never split awkwardly. Each block contains:
   - Header: name + recipe code, and a "Needs attention" line listing detected data gaps.
   - Meta grid: Category, Base portions, Yield/output, Production loss %, Yield %,
     Shelf life, Storage, Allergens.
   - Description / Preparation / Production notes (only rendered if present, to save space).
   - Ingredients table: Ingredient, Quantity, Unit, Notes, **Chef correction** (wide blank).
   - Compact correction area: yes/no checkboxes + free-text + "Checked by" / "Date".

## Data-field mapping (English label → source)

| Print label            | Source                                                            |
|------------------------|-------------------------------------------------------------------|
| Recipe name            | `recipes.name` (kept as stored)                                   |
| Recipe code            | `recipes.recipe_code`                                             |
| Base portions          | `recipes.base_portions`                                           |
| Yield / output         | `recipes.yield_quantity` + `yield_unit` (short_name/name)         |
| Production loss %       | `recipes.production_loss_pct`                                     |
| Yield %                | `recipes.yield_pct`                                               |
| Shelf life             | `recipes.shelf_life`                                              |
| Description            | `recipes.description`                                             |
| Preparation            | `recipes.preparation`                                             |
| Production notes       | `recipes.production_notes`                                        |
| Usage notes            | `recipes.usage_notes`                                             |
| Allergens              | aggregated from `recipe_ingredients → ingredients.allergens`      |
| Ingredient / Qty / Unit / Notes | `recipe_ingredients` (+ joined `ingredient`, `unit`)    |

### Fields with no DB source → left blank for the chef

`Category` and `Storage` do **not** exist on the `recipes` table (confirmed against
schema, service, and the recipe form). Rather than add DB columns that nothing populates
or edits (that would be a parallel, dead architecture and violate the "no parallel
architecture" constraint), they are rendered as **blank review lines the chef fills in by
hand**. This is exactly the review document's purpose — surfacing and capturing missing
data. **No migration is required for this feature.**

`Prep / cut` per ingredient also has no dedicated column; the ingredient `notes` column is
shown, and the wide "Chef correction" column captures cut/prep corrections by hand.

### Allergens — fixed vocabulary translation (not AI translation)

Allergens are stored in German from the fixed EU-14 controlled vocabulary
(`ALLERGENS` in `types/index.ts`). They are mapped to their English names via a static
lookup (`Milch → Milk`, `Eier → Eggs`, …), falling back to the raw stored value for
anything unknown. This is a fixed dictionary lookup on a regulatory list, **not** automatic
translation of free text, and directly serves the English-speaking chef.

## Technical approach (no parallel architecture)

- **Data:** one new read method `recipesService.getAllForReview()` (all non-archived
  recipes with nested `recipe_ingredients → ingredient, unit` and `yield_unit`, ordered by
  name) + a `useRecipeReview()` React Query hook. Reuses the existing Supabase client,
  service and hook patterns.
- **Route:** `/print/recipe-review` (a normal App-Router page). `AppLayout` detects the
  `/print` prefix and renders the page bare — no sidebar, no app chrome.
- **Rendering:** a self-contained `RecipeReviewDocument` component with its own light-theme,
  A4-optimised print CSS (`recipe-review-print.css`). White background, black text, clean
  hierarchy. A visible "Print / Save as PDF" button (`window.print()`) is hidden in the
  actual print output via `.rr-no-print`.
- **Entry point:** a "Print Recipe Review" button on the recipes list page that opens the
  print view in a new browser tab.

All labels in the print output are English. Existing production, purchasing and import
features are untouched.
