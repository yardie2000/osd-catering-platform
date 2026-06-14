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
  DEFAULT_CALC_CONFIG,
  type CalcMenu,
  type CalcRecipe,
} from '@/lib/purchasing/aggregate'

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
