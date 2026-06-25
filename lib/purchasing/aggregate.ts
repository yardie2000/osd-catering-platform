import type { SupplierProduct } from '@/types'

// ─────────────────────────────────────────────────────────────────────────
// V5.1 calculation engine — shared core.
//
// Implements the kitchen formula exactly:
//   Required   = portionQty × PAX           (portionQty = recipeQty / base)
//   Production = Required   × (1 + loss%)    (Production Factor)
//   Purchasing = Production ÷ yield%
//
// Loss% and yield% are resolved per recipe (column override) falling back to a
// global default config. They apply ONLY to mass/volume units; counts and
// qualitative ("to taste") units are never inflated. Production and Purchasing
// derive from ONE scaling pass so they can never diverge.
// ─────────────────────────────────────────────────────────────────────────

// ── Deep-embed shapes returned by purchasingService.getMenusForCalc ──
export type CalcUnit = {
  id:         string
  unit_code:  string
  name:       string
  short_name: string | null
}

export type CalcRecipeIngredient = {
  id:            string
  quantity:      number
  ingredient_id: string
  unit_id:       string
  ingredient:    { id: string; ingredient_code: string; name: string; category: string | null } | null
  unit:          CalcUnit | null
}

export type CalcRecipe = {
  id:                  string
  recipe_code:         string
  name:                string
  base_portions:       number | null   // V5.1 primary portion basis (takes precedence over yield_quantity)
  yield_quantity:      number | null
  production_notes:    string | null
  production_loss_pct: number | null   // V5.1 per-recipe override (null -> global default)
  yield_pct:           number | null   // V5.1 per-recipe override (null -> global default)
  recipe_ingredients:  CalcRecipeIngredient[]
}

export type CalcMenuItem = {
  id:        string
  name:      string
  recipe_id: string | null
  recipe:    CalcRecipe | null
}

export type CalcMenu = {
  id:         string
  menu_code:  string
  menu_name:  string
  menu_items: CalcMenuItem[]
}

// ── Input / output ──────────────────────────────────────────

export type CalcInputRow = {
  menu:  CalcMenu
  count: number      // pax of this menu
}

// 'base'  → recipe.base_portions (V5.1 canonical portion basis)
// 'yield' → recipe.yield_quantity (legacy fallback for un-migrated recipes)
// 'notes' → parsed "<n> Portionen" from production_notes
// 'assumed' → global default (review-worthy)
export type BaseSource = 'base' | 'yield' | 'notes' | 'assumed'

// Unit semantics. Loss/yield apply ONLY to mass|volume; counts scale by pax but
// are never loss/yield-inflated; qualitative units ("to taste") are not orderable.
export type UnitClass = 'mass' | 'volume' | 'count' | 'qualitative'

// V5.1 global calculation config (Option 1: global defaults, per-recipe overridable).
export type CalcConfig = {
  defaultBasePortions: number   // fallback base when a recipe has no yield base
  productionLossPct:   number   // default production loss %  (Production Factor = 1 + loss/100)
  yieldPct:            number   // default usable yield %     (Purchasing = Production ÷ yield/100)
}

export const DEFAULT_CALC_CONFIG: CalcConfig = {
  defaultBasePortions: 50,
  productionLossPct:   10,   // from the spec worked example
  yieldPct:            80,   // from the spec worked example
}

// How the per-recipe portion basis was determined (for transparency).
export type RecipeBaseInfo = {
  recipe_code: string
  recipe_name: string
  menu:        string
  base:        number
  source:      BaseSource
}

export type PurchasingLine = {
  ingredient_id:     string
  ingredient_code:   string
  ingredient_name:   string
  category:          string | null
  unit_id:           string
  unit_label:        string
  unit_class:        UnitClass
  required_quantity: number          // before loss/yield
  production_quantity: number        // required × (1 + loss%)
  quantity:          number          // PURCHASING qty = production ÷ yield%  (headline)
  supplier_name:     string | null
  unit_price:        number | null
  est_cost:          number | null
  alternatives:      number
}

export type PurchasingWarning = {
  kind:   'no_recipe' | 'no_ingredients'
  menu:   string
  detail: string
}

export type PurchasingResult = {
  lines:       PurchasingLine[]
  warnings:    PurchasingWarning[]
  assumptions: RecipeBaseInfo[]   // recipes scaled WITHOUT a structured base/yield (review-worthy)
  totalCost:   number | null
}

function unitLabel(u: CalcUnit | null): string {
  if (!u) return '—'
  return u.short_name || u.name || u.unit_code
}

// ── unit classification ─────────────────────────────────────
const MASS_CODES   = new Set(['g', 'kg', 'mg'])
const VOLUME_CODES = new Set(['ml', 'l', 'cl', 'dl'])
// NB: the DB stores normalised unit_codes (ü→ue, space→_), e.g. "stueck",
// "eigelb". Match those forms, not just the pretty names.
const COUNT_CODES  = new Set([
  'stück', 'stueck', 'stk', 'stk.', 'st', 'pcs', 'stuck', 'portion', 'portionen',
  'ei', 'eier', 'eigelb', 'scheibe', 'scheiben', 'blatt', 'blätter', 'bund', 'zehe',
  'zehen', 'dose', 'dosen', 'packung', 'pkg', 'kopf', 'stange', 'stangen',
])

export function classifyUnit(unit: CalcUnit | null): UnitClass {
  const code = (unit?.unit_code || unit?.short_name || '').trim().toLowerCase()
  if (MASS_CODES.has(code)) return 'mass'
  if (VOLUME_CODES.has(code)) return 'volume'
  if (COUNT_CODES.has(code)) return 'count'
  return 'qualitative'   // Geschmack, Bedarf, EL, TL, Prise, "5-10Gr", …
}

const isPhysical = (cls: UnitClass) => cls === 'mass' || cls === 'volume'

// ── metric canonicalisation (kg→g, l→ml); DB has no conversion_factor data ──
type UnitLite = { id: string; unit_code: string; name: string; short_name: string | null }

function canonicalize(
  unit: CalcUnit | null,
  unitId: string,
  baseByCode: Map<string, UnitLite>,
): { key: string; unitId: string; unit: CalcUnit | null; factor: number } {
  const code = (unit?.unit_code || '').toLowerCase()
  if (code === 'g' || code === 'kg') {
    const base = baseByCode.get('g') ?? unit
    return { key: 'b:g', unitId: base?.id ?? unitId, unit: base, factor: code === 'kg' ? 1000 : 1 }
  }
  if (code === 'l' || code === 'ml') {
    const base = baseByCode.get('ml') ?? unit
    return { key: 'b:ml', unitId: base?.id ?? unitId, unit: base, factor: code === 'l' ? 1000 : 1 }
  }
  return { key: `u:${unitId}`, unitId, unit, factor: 1 }
}

// Extract a portion basis from free-text production_notes, e.g.
//   "Portionsbasis: 60–70 Portionen"  → 65 (range midpoint)
//   "= 50 Portionen"                  → 50
// Returns null when no "<n> Portionen" pattern is present.
export function parseBasePortions(notes: string | null): number | null {
  if (!notes) return null
  const m = notes.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*Portionen/i)
  if (!m) return null
  const a = parseInt(m[1], 10)
  if (!a || a <= 0) return null
  const b = m[2] ? parseInt(m[2], 10) : null
  return b && b > 0 ? Math.round((a + b) / 2) : a
}

// Determine the portion basis used to scale a recipe to `count` portions.
// V5.1: base_portions (the recipe's standard portion count) is the canonical
// basis and takes precedence. yield_quantity stays as a legacy fallback for
// recipes that have not been migrated to base_portions yet, then a value parsed
// from production_notes, then the global default.
export function resolveBase(recipe: CalcRecipe, fallback: number): { base: number; source: BaseSource } {
  if (recipe.base_portions && recipe.base_portions > 0) {
    return { base: recipe.base_portions, source: 'base' }
  }
  if (recipe.yield_quantity && recipe.yield_quantity > 0) {
    return { base: recipe.yield_quantity, source: 'yield' }
  }
  const parsed = parseBasePortions(recipe.production_notes)
  if (parsed) return { base: parsed, source: 'notes' }
  return { base: fallback, source: 'assumed' }
}

// Resolve effective loss/yield for a recipe (override → global default). Clamped sane.
export function resolveLossPct(recipe: CalcRecipe, cfg: CalcConfig): number {
  const v = recipe.production_loss_pct ?? cfg.productionLossPct
  return Number.isFinite(v) && v >= 0 ? v : 0
}
export function resolveYieldPct(recipe: CalcRecipe, cfg: CalcConfig): number {
  const v = recipe.yield_pct ?? cfg.yieldPct
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : 100
}

// Apply the production + purchasing factors to a net (required) quantity.
// Non-physical units pass straight through (no loss, no yield).
export function applyFactors(
  required: number,
  cls: UnitClass,
  lossPct: number,
  yieldPct: number,
): { production: number; purchasing: number } {
  if (!isPhysical(cls)) return { production: required, purchasing: required }
  const production = required * (1 + lossPct / 100)
  const purchasing = production / (yieldPct / 100)
  return { production, purchasing }
}

// Normalise a config from either a full CalcConfig or a legacy number (base only).
export function asConfigForPlan(input: CalcConfig | number | undefined): CalcConfig {
  if (typeof input === 'number') return { ...DEFAULT_CALC_CONFIG, defaultBasePortions: input > 0 ? input : 50 }
  return { ...DEFAULT_CALC_CONFIG, ...(input ?? {}) }
}
const asConfig = asConfigForPlan

// Pick the cheapest supplier_product whose package_unit matches the line's unit.
function resolveSupplier(
  products: SupplierProduct[],
  unit: CalcUnit | null,
): { supplier_name: string | null; unit_price: number | null; alternatives: number } {
  const alternatives = products.length
  if (alternatives === 0) return { supplier_name: null, unit_price: null, alternatives }

  const unitTokens = [unit?.short_name, unit?.unit_code, unit?.name]
    .filter(Boolean)
    .map((t) => (t as string).trim().toLowerCase())

  let best: { name: string; price: number } | null = null
  for (const p of products) {
    if (
      p.package_unit &&
      p.package_quantity &&
      p.package_quantity > 0 &&
      p.supplier_pack_price != null &&
      unitTokens.includes(p.package_unit.trim().toLowerCase())
    ) {
      const price = p.supplier_pack_price / p.package_quantity
      if (!best || price < best.price) best = { name: p.supplier_name, price }
    }
  }

  if (best) return { supplier_name: best.name, unit_price: best.price, alternatives }
  return { supplier_name: products[0].supplier_name, unit_price: null, alternatives }
}

/**
 * Aggregate ingredient demand for a set of (menu, count) rows into a purchasing
 * list. Per recipe-ingredient: Required = qty × (count/base) × metricFactor;
 * Production = Required × (1+loss%); Purchasing = Production ÷ yield% (mass/volume
 * only). Aggregated per (ingredient, canonical unit) AFTER the per-recipe factors,
 * so recipes with different loss/yield merge correctly.
 */
export function aggregatePurchasing(
  rows: CalcInputRow[],
  supplierProducts: SupplierProduct[],
  config: CalcConfig | number | undefined,
  units: UnitLite[] = [],
): PurchasingResult {
  const cfg = asConfig(config)
  type Acc = {
    ingredient_id: string
    ingredient_code: string
    ingredient_name: string
    category: string | null
    unit_id: string
    unit: CalcUnit | null
    unit_class: UnitClass
    required: number
    production: number
    purchasing: number
  }
  const acc = new Map<string, Acc>()
  const warnings: PurchasingWarning[] = []
  const assumptions = new Map<string, RecipeBaseInfo>()
  const warnedNoRecipe = new Set<string>()
  const warnedNoIng = new Set<string>()

  const fallback = cfg.defaultBasePortions > 0 ? cfg.defaultBasePortions : 1
  const baseByCode = new Map<string, UnitLite>()
  for (const u of units) {
    const c = u.unit_code.toLowerCase()
    if (c === 'g' || c === 'ml') baseByCode.set(c, u)
  }

  for (const { menu, count } of rows) {
    if (!count || count <= 0) continue
    for (const item of menu.menu_items) {
      const recipe = item.recipe
      if (!recipe || !item.recipe_id) {
        if (!warnedNoRecipe.has(item.id)) {
          warnings.push({ kind: 'no_recipe', menu: menu.menu_name, detail: item.name })
          warnedNoRecipe.add(item.id)
        }
        continue
      }
      if (recipe.recipe_ingredients.length === 0) {
        if (!warnedNoIng.has(recipe.id)) {
          warnings.push({ kind: 'no_ingredients', menu: menu.menu_name, detail: `${recipe.recipe_code} · ${recipe.name}` })
          warnedNoIng.add(recipe.id)
        }
        continue
      }

      const { base, source } = resolveBase(recipe, fallback)
      if (source !== 'base' && source !== 'yield' && !assumptions.has(recipe.id)) {
        assumptions.set(recipe.id, { recipe_code: recipe.recipe_code, recipe_name: recipe.name, menu: menu.menu_name, base, source })
      }

      const lossPct = resolveLossPct(recipe, cfg)
      const yieldPct = resolveYieldPct(recipe, cfg)
      const scale = count / base
      for (const ri of recipe.recipe_ingredients) {
        if (!ri.ingredient) continue
        const c = canonicalize(ri.unit, ri.unit_id, baseByCode)
        const cls = classifyUnit(c.unit)
        const required = ri.quantity * scale * c.factor
        const { production, purchasing } = applyFactors(required, cls, lossPct, yieldPct)
        const key = `${ri.ingredient_id}::${c.key}`
        const existing = acc.get(key)
        if (existing) {
          existing.required += required
          existing.production += production
          existing.purchasing += purchasing
        } else {
          acc.set(key, {
            ingredient_id:   ri.ingredient_id,
            ingredient_code: ri.ingredient.ingredient_code,
            ingredient_name: ri.ingredient.name,
            category:        ri.ingredient.category,
            unit_id:         c.unitId,
            unit:            c.unit,
            unit_class:      cls,
            required, production, purchasing,
          })
        }
      }
    }
  }

  const byIngredient = new Map<string, SupplierProduct[]>()
  for (const p of supplierProducts) {
    const list = byIngredient.get(p.ingredient_id) ?? []
    list.push(p)
    byIngredient.set(p.ingredient_id, list)
  }

  let totalCost: number | null = null
  const lines: PurchasingLine[] = [...acc.values()]
    .map((a) => {
      const sup = resolveSupplier(byIngredient.get(a.ingredient_id) ?? [], a.unit)
      const est_cost = sup.unit_price != null ? a.purchasing * sup.unit_price : null
      if (est_cost != null) totalCost = (totalCost ?? 0) + est_cost
      return {
        ingredient_id:       a.ingredient_id,
        ingredient_code:     a.ingredient_code,
        ingredient_name:     a.ingredient_name,
        category:            a.category,
        unit_id:             a.unit_id,
        unit_label:          unitLabel(a.unit),
        unit_class:          a.unit_class,
        required_quantity:   a.required,
        production_quantity: a.production,
        quantity:            a.purchasing,
        supplier_name:       sup.supplier_name,
        unit_price:          sup.unit_price,
        est_cost,
        alternatives:        sup.alternatives,
      }
    })
    .sort((x, y) => x.ingredient_name.localeCompare(y.ingredient_name, 'de'))

  return { lines, warnings, assumptions: [...assumptions.values()], totalCost }
}
