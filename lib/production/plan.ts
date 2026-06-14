import {
  resolveBase,
  resolveLossPct,
  classifyUnit,
  applyFactors,
  asConfigForPlan,
  type CalcConfig,
  type CalcMenu,
  type BaseSource,
  type RecipeBaseInfo,
  type UnitClass,
} from '../purchasing/aggregate'

// One production batch = one recipe to be produced, scaled to the total
// portions needed across all selected menus (a recipe used in several menus
// is summed into a single batch). Production quantity applies the production
// loss factor (1 + loss%) to the net required amount, for mass/volume units.

export type ProductionIngredient = {
  ingredient_name:   string
  unit_label:        string
  unit_class:        UnitClass
  required_quantity: number   // net (before loss)
  quantity:          number   // PRODUCTION qty = required × (1 + loss%)  (headline)
}

export type ProductionBatch = {
  recipe_id:           string
  recipe_code:         string
  recipe_name:         string
  portions_needed:     number
  base:                number
  source:              BaseSource
  batch_factor:        number          // portions_needed / base
  production_loss_pct: number          // effective loss applied
  menus:               string[]
  has_ingredients:     boolean
  ingredients:         ProductionIngredient[]
}

export type ProductionWarning = {
  kind:   'no_recipe'
  menu:   string
  detail: string
}

export type ProductionPlanResult = {
  batches:     ProductionBatch[]
  warnings:    ProductionWarning[]
  assumptions: RecipeBaseInfo[]
}

function unitLabelOf(u: { short_name: string | null; name: string; unit_code: string } | null): string {
  if (!u) return '—'
  return u.short_name || u.name || u.unit_code
}

/**
 * Build a production plan from (menu, count) rows. Aggregates per recipe:
 * a recipe appearing in multiple selected menus is summed into one batch.
 * Scaling = portions_needed / base; production qty = required × (1 + loss%).
 */
export function buildProductionPlan(
  rows: { menu: CalcMenu; count: number }[],
  config: CalcConfig | number | undefined,
): ProductionPlanResult {
  const cfg = asConfigForPlan(config)
  type Acc = {
    recipe: NonNullable<CalcMenu['menu_items'][number]['recipe']>
    portions: number
    menus: Set<string>
  }
  const byRecipe = new Map<string, Acc>()
  const warnings: ProductionWarning[] = []
  const warnedNoRecipe = new Set<string>()
  const fallback = cfg.defaultBasePortions > 0 ? cfg.defaultBasePortions : 1

  for (const { menu, count } of rows) {
    if (!count || count <= 0) continue
    const seen = new Set<string>()
    for (const item of menu.menu_items) {
      if (!item.recipe || !item.recipe_id) {
        if (!warnedNoRecipe.has(item.id)) {
          warnings.push({ kind: 'no_recipe', menu: menu.menu_name, detail: item.name })
          warnedNoRecipe.add(item.id)
        }
        continue
      }
      if (seen.has(item.recipe_id)) continue
      seen.add(item.recipe_id)

      const existing = byRecipe.get(item.recipe_id)
      if (existing) {
        existing.portions += count
        existing.menus.add(menu.menu_name)
      } else {
        byRecipe.set(item.recipe_id, { recipe: item.recipe, portions: count, menus: new Set([menu.menu_name]) })
      }
    }
  }

  const assumptions = new Map<string, RecipeBaseInfo>()
  const batches: ProductionBatch[] = [...byRecipe.values()].map((a) => {
    const { base, source } = resolveBase(a.recipe, fallback)
    if (source !== 'base' && source !== 'yield' && !assumptions.has(a.recipe.id)) {
      assumptions.set(a.recipe.id, {
        recipe_code: a.recipe.recipe_code,
        recipe_name: a.recipe.name,
        menu:        [...a.menus][0] ?? '',
        base,
        source,
      })
    }
    const lossPct = resolveLossPct(a.recipe, cfg)
    const scale = a.portions / base
    const ingredients: ProductionIngredient[] = a.recipe.recipe_ingredients
      .filter((ri) => ri.ingredient)
      .map((ri) => {
        const cls = classifyUnit(ri.unit)
        const required = ri.quantity * scale
        const { production } = applyFactors(required, cls, lossPct, 100) // yield not applied to production
        return {
          ingredient_name:   ri.ingredient!.name,
          unit_label:        unitLabelOf(ri.unit),
          unit_class:        cls,
          required_quantity: required,
          quantity:          production,
        }
      })
    return {
      recipe_id:           a.recipe.id,
      recipe_code:         a.recipe.recipe_code,
      recipe_name:         a.recipe.name,
      portions_needed:     a.portions,
      base,
      source,
      batch_factor:        scale,
      production_loss_pct: lossPct,
      menus:               [...a.menus],
      has_ingredients:     ingredients.length > 0,
      ingredients,
    }
  })

  batches.sort((x, y) => x.recipe_name.localeCompare(y.recipe_name, 'de'))
  return { batches, warnings, assumptions: [...assumptions.values()] }
}
