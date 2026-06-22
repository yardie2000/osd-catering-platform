// Tests for the V4.2/V4.5 kitchen calculation engine (lib/purchasing/aggregate.ts).
//   Required   = portionQty × PAX           (portionQty = recipeQty / base)
//   Production  = Required   × (1 + loss%)
//   Purchasing  = Production ÷ yield%
// Run: node --import ./tests/register.mjs --test tests/calc.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

const approx = (actual: number, expected: number, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `expected ≈ ${expected}, got ${actual}`)

import {
  applyFactors,
  classifyUnit,
  resolveBase,
  resolveLossPct,
  resolveYieldPct,
  aggregatePurchasing,
  explodeMenuRows,
  DEFAULT_CALC_CONFIG,
  type CalcMenu,
  type CalcRecipe,
  type CalcMenuItemComponent,
} from '@/lib/purchasing/aggregate'
import { buildProductionPlan } from '@/lib/production/plan'
import { buildCalcMenus, type RawCalcMenu } from '@/lib/operations/calcMenu'

const GRAMM = { id: 'u-g', unit_code: 'g', name: 'Gramm', short_name: 'g' }

function recipe(overrides: Partial<CalcRecipe> = {}): CalcRecipe {
  return {
    id: 'r1',
    recipe_code: 'REC-0001',
    name: 'Testsauce',
    base_portions: null,
    yield_quantity: 50,
    production_notes: null,
    production_loss_pct: null,
    yield_pct: null,
    recipe_ingredients: [
      {
        id: 'ri1',
        quantity: 200,
        ingredient_id: 'ing1',
        unit_id: GRAMM.id,
        ingredient: { id: 'ing1', ingredient_code: 'ZUT-001', name: 'Mehl', category: null },
        unit: GRAMM,
      },
    ],
    ...overrides,
  }
}

function menu(recipeForItem: CalcRecipe | null): CalcMenu {
  return {
    id: 'm1',
    menu_code: 'MEN-001',
    menu_name: 'Testmenü',
    menu_items: [
      { id: 'mi1', name: 'Position 1', recipe_id: recipeForItem ? recipeForItem.id : null, recipe: recipeForItem },
    ],
  }
}

test('applyFactors inflates mass by loss then yield', () => {
  const { production, purchasing } = applyFactors(100, 'mass', 10, 80)
  approx(production, 110)
  approx(purchasing, 137.5)
})

test('applyFactors passes non-physical (count) units through unchanged', () => {
  const { production, purchasing } = applyFactors(100, 'count', 10, 80)
  assert.equal(production, 100)
  assert.equal(purchasing, 100)
})

test('classifyUnit recognises mass codes', () => {
  assert.equal(classifyUnit(GRAMM), 'mass')
  assert.equal(classifyUnit({ id: 'x', unit_code: 'Stk', name: 'Stück', short_name: 'Stk' }), 'count')
})

test('resolveBase prefers base_portions, then yield_quantity, then notes, then fallback', () => {
  // base_portions wins even when yield_quantity is also present
  assert.deepEqual(resolveBase(recipe({ base_portions: 40, yield_quantity: 50 }), 99), {
    base: 40,
    source: 'base',
  })
  // no base_portions → fall back to yield_quantity
  assert.deepEqual(resolveBase(recipe({ base_portions: null, yield_quantity: 50 }), 99), {
    base: 50,
    source: 'yield',
  })
  assert.deepEqual(
    resolveBase(recipe({ base_portions: null, yield_quantity: null, production_notes: '= 60 Portionen' }), 99),
    { base: 60, source: 'notes' },
  )
  assert.deepEqual(
    resolveBase(recipe({ base_portions: null, yield_quantity: null, production_notes: null }), 99),
    { base: 99, source: 'assumed' },
  )
})

test('resolveLossPct / resolveYieldPct use overrides, else global defaults', () => {
  assert.equal(resolveLossPct(recipe({ production_loss_pct: 15 }), DEFAULT_CALC_CONFIG), 15)
  assert.equal(resolveLossPct(recipe({ production_loss_pct: null }), DEFAULT_CALC_CONFIG), 10)
  assert.equal(resolveYieldPct(recipe({ yield_pct: 90 }), DEFAULT_CALC_CONFIG), 90)
  assert.equal(resolveYieldPct(recipe({ yield_pct: null }), DEFAULT_CALC_CONFIG), 80)
})

test('aggregatePurchasing scales a recipe to PAX and applies loss + yield', () => {
  // 200 g per 50 portions, 100 PAX → scale 2 → 400 g required.
  // production = 400 × 1.1 = 440 g; purchasing = 440 ÷ 0.8 = 550 g.
  const result = aggregatePurchasing(
    [{ menu: menu(recipe()), count: 100 }],
    [],
    DEFAULT_CALC_CONFIG,
    [GRAMM],
  )
  assert.equal(result.lines.length, 1)
  const line = result.lines[0]
  assert.equal(line.ingredient_name, 'Mehl')
  assert.equal(line.unit_class, 'mass')
  assert.equal(Math.round(line.required_quantity), 400)
  assert.equal(Math.round(line.production_quantity), 440)
  assert.equal(Math.round(line.quantity), 550)
})

test('aggregatePurchasing uses base_portions over yield_quantity as the scaling basis', () => {
  // base_portions 40 (NOT yield_quantity 50) → scale 80/40 = 2 → 400 g required.
  const r = recipe({ base_portions: 40, yield_quantity: 50 })
  const result = aggregatePurchasing([{ menu: menu(r), count: 80 }], [], DEFAULT_CALC_CONFIG, [GRAMM])
  assert.equal(result.lines.length, 1)
  assert.equal(Math.round(result.lines[0].required_quantity), 400) // 200 × (80/40)
  // base_portions is a structured basis → not flagged as a review-worthy assumption
  assert.equal(result.assumptions.length, 0)
})

test('aggregatePurchasing warns when a menu item has no recipe', () => {
  const result = aggregatePurchasing([{ menu: menu(null), count: 10 }], [], DEFAULT_CALC_CONFIG, [GRAMM])
  assert.equal(result.lines.length, 0)
  assert.equal(result.warnings.length, 1)
  assert.equal(result.warnings[0].kind, 'no_recipe')
})

// ── V5 Komponenten-Modell ──────────────────────────────────────

const STK = { id: 'u-stk', unit_code: 'Stk', name: 'Stück', short_name: 'Stk' }

// A pre-produced sauce: base 1 portion, 50 g cream per portion.
function sauceRecipe(): CalcRecipe {
  return {
    id: 'r-sauce', recipe_code: 'SAU-001', name: 'Haselnuss-Sauce',
    base_portions: 1, yield_quantity: null, production_notes: null,
    production_loss_pct: null, yield_pct: null,
    recipe_ingredients: [{
      id: 'ri-s', quantity: 50, ingredient_id: 'ing-cream', unit_id: GRAMM.id,
      ingredient: { id: 'ing-cream', ingredient_code: 'ZUT-CREAM', name: 'Sahne', category: null },
      unit: GRAMM,
    }],
  }
}

function compMenu(components: CalcMenuItemComponent[]): CalcMenu {
  return {
    id: 'm-c', menu_code: 'MEN-C', menu_name: 'KompMenü',
    menu_items: [{ id: 'mi-c', name: 'Teller', recipe_id: null, recipe: null, components }],
  }
}
const recipeComp = (r: CalcRecipe, qty: number): CalcMenuItemComponent => ({
  id: 'c-r', recipe_id: r.id, ingredient_id: null, quantity: qty, unit_id: null, recipe: r, ingredient: null, unit: null,
})
const ingredientComp = (qty: number): CalcMenuItemComponent => ({
  id: 'c-i', recipe_id: null, ingredient_id: 'ing-poularde', quantity: qty, unit_id: STK.id,
  recipe: null, ingredient: { id: 'ing-poularde', ingredient_code: 'ZUK-P', name: 'Poularde', category: null }, unit: STK,
})

test('recipe component → raw purchasing scaled by portions (1 Portion/Position × pax)', () => {
  const m = compMenu([recipeComp(sauceRecipe(), 1)])
  const r = aggregatePurchasing([{ menu: m, count: 100 }], [], DEFAULT_CALC_CONFIG, [GRAMM])
  // 100 Portionen × 50 g = 5000 g required; ×1.1 = 5500; ÷0.8 = 6875
  assert.equal(r.lines.length, 1)
  assert.equal(r.lines[0].ingredient_name, 'Sahne')
  assert.equal(Math.round(r.lines[0].required_quantity), 5000)
  assert.equal(Math.round(r.lines[0].quantity), 6875)
})

test('recipe component → production (Vorproduktion) lists the sauce by portions', () => {
  const m = compMenu([recipeComp(sauceRecipe(), 1)])
  const p = buildProductionPlan([{ menu: m, count: 100 }], DEFAULT_CALC_CONFIG)
  assert.equal(p.batches.length, 1)
  assert.equal(p.batches[0].recipe_code, 'SAU-001')
  assert.equal(p.batches[0].portions_needed, 100)
})

test('ingredient component → purchasing direct (count, no loss/yield), no production', () => {
  const m = compMenu([ingredientComp(1)])
  const r = aggregatePurchasing([{ menu: m, count: 100 }], [], DEFAULT_CALC_CONFIG, [GRAMM, STK])
  assert.equal(r.lines.length, 1)
  assert.equal(r.lines[0].ingredient_name, 'Poularde')
  assert.equal(r.lines[0].unit_class, 'count')
  assert.equal(r.lines[0].quantity, 100) // counts are never loss/yield-inflated
  const p = buildProductionPlan([{ menu: m, count: 100 }], DEFAULT_CALC_CONFIG)
  assert.equal(p.batches.length, 0) // bought item is not produced
})

test('mixed position: recipe + ingredient components both resolve', () => {
  const m = compMenu([recipeComp(sauceRecipe(), 1), ingredientComp(1)])
  const r = aggregatePurchasing([{ menu: m, count: 50 }], [], DEFAULT_CALC_CONFIG, [GRAMM, STK])
  const names = r.lines.map((l) => l.ingredient_name).sort()
  assert.deepEqual(names, ['Poularde', 'Sahne'])
  const p = buildProductionPlan([{ menu: m, count: 50 }], DEFAULT_CALC_CONFIG)
  assert.equal(p.batches.length, 1) // only the sauce is pre-produced
  assert.equal(p.batches[0].portions_needed, 50)
})

test('components take precedence over the legacy recipe_id', () => {
  // menu_item has BOTH a legacy recipe AND components → components win.
  const m: CalcMenu = {
    id: 'm-x', menu_code: 'MEN-X', menu_name: 'X',
    menu_items: [{
      id: 'mi-x', name: 'Teller', recipe_id: 'r1', recipe: recipe(),
      components: [ingredientComp(2)],
    }],
  }
  const r = aggregatePurchasing([{ menu: m, count: 10 }], [], DEFAULT_CALC_CONFIG, [GRAMM, STK])
  assert.equal(r.lines.length, 1)
  assert.equal(r.lines[0].ingredient_name, 'Poularde') // not "Mehl" from the legacy recipe
  assert.equal(r.lines[0].quantity, 20) // 2 × 10
})

test('explodeMenuRows falls back to legacy recipe_id when no components', () => {
  const { recipeDemands, ingredientDemands, warnings } = explodeMenuRows([{ menu: menu(recipe()), count: 30 }])
  assert.equal(recipeDemands.length, 1)
  assert.equal(recipeDemands[0].portions, 30)
  assert.equal(ingredientDemands.length, 0)
  assert.equal(warnings.length, 0)
})

// ── V5 Positions-Katalog: buildCalcMenus (menu_positions → CalcMenu) ──

test('buildCalcMenus uses menu_positions (sorted) and carries components', () => {
  const raw: RawCalcMenu[] = [{
    id: 'm1', menu_code: 'M1', menu_name: 'M1',
    menu_positions: [
      { id: 'mp2', sort_order: 2, position: { id: 'p2', name: 'Zweite', components: [ingredientComp(1)] } },
      { id: 'mp1', sort_order: 1, position: { id: 'p1', name: 'Erste', components: [recipeComp(sauceRecipe(), 1)] } },
    ],
  }]
  const out = buildCalcMenus(raw)
  assert.equal(out.length, 1)
  assert.equal(out[0].menu_items.length, 2)
  assert.equal(out[0].menu_items[0].name, 'Erste') // sort_order 1 first
  assert.equal(out[0].menu_items[1].name, 'Zweite')
  assert.equal(out[0].menu_items[0].recipe_id, null)
  assert.equal(out[0].menu_items[0].components?.length, 1)
})

test('buildCalcMenus yields no menu_items when a menu has no positions', () => {
  const raw: RawCalcMenu[] = [{
    id: 'm2', menu_code: 'M2', menu_name: 'M2',
    menu_positions: [],
  }]
  const out = buildCalcMenus(raw)
  assert.equal(out[0].menu_items.length, 0)
})

test('buildCalcMenus → aggregatePurchasing end-to-end (positions path)', () => {
  const raw: RawCalcMenu[] = [{
    id: 'm3', menu_code: 'M3', menu_name: 'M3',
    menu_positions: [
      { id: 'mp', sort_order: 0, position: { id: 'p', name: 'Teller', components: [recipeComp(sauceRecipe(), 1)] } },
    ],
  }]
  const menus = buildCalcMenus(raw)
  const r = aggregatePurchasing([{ menu: menus[0], count: 100 }], [], DEFAULT_CALC_CONFIG, [GRAMM])
  assert.equal(r.lines.length, 1)
  assert.equal(r.lines[0].ingredient_name, 'Sahne')
  assert.equal(Math.round(r.lines[0].required_quantity), 5000)
})
