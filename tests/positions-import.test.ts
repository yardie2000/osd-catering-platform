// Tests for the V5 positions-catalog import sheet schemas (ValidationEngine).
//   positions · menu_positions · position_components
// Run: node --import ./tests/register.mjs --test tests/positions-import.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  positionRowSchema,
  menuPositionRowSchema,
  positionComponentRowSchema,
} from '@/lib/importers/ValidationEngine'

// ── positions ────────────────────────────────────────────────
test('positions: full row parses, allergens split, German price', () => {
  const r = positionRowSchema.parse({
    position_code: 'POS-0007',
    name: 'Kartoffelsalat',
    description: 'klassisch',
    dietary: 'vegan',
    allergens: 'Gluten, Senf; Ei',
    default_price: '1.000,50',
  })
  assert.equal(r.position_code, 'POS-0007')
  assert.equal(r.name, 'Kartoffelsalat')
  assert.deepEqual(r.allergens, ['Gluten', 'Senf', 'Ei'])
  assert.equal(r.default_price, 1000.5)
})

test('positions: allergens array passthrough, empty → []', () => {
  assert.deepEqual(positionRowSchema.parse({ position_code: 'P1', name: 'X', allergens: ['Milch'] }).allergens, ['Milch'])
  assert.deepEqual(positionRowSchema.parse({ position_code: 'P1', name: 'X', allergens: null }).allergens, [])
  assert.deepEqual(positionRowSchema.parse({ position_code: 'P1', name: 'X' }).allergens, [])
})

test('positions: position_code and name are required', () => {
  assert.equal(positionRowSchema.safeParse({ name: 'X' }).success, false)
  assert.equal(positionRowSchema.safeParse({ position_code: 'P1' }).success, false)
  assert.equal(positionRowSchema.safeParse({ position_code: '', name: 'X' }).success, false)
})

test('positions: missing default_price → null', () => {
  assert.equal(positionRowSchema.parse({ position_code: 'P1', name: 'X' }).default_price, null)
})

// ── menu_positions ───────────────────────────────────────────
test('menu_positions: sort_order defaults to 0, price_override German-parsed', () => {
  const r = menuPositionRowSchema.parse({ menu_code: 'M-1', position_code: 'POS-0007', price_override: '12,50' })
  assert.equal(r.menu_code, 'M-1')
  assert.equal(r.position_code, 'POS-0007')
  assert.equal(r.sort_order, 0)
  assert.equal(r.price_override, 12.5)
})

test('menu_positions: sort_order coerced from string', () => {
  assert.equal(menuPositionRowSchema.parse({ menu_code: 'M-1', position_code: 'P', sort_order: '3' }).sort_order, 3)
})

test('menu_positions: both codes required', () => {
  assert.equal(menuPositionRowSchema.safeParse({ position_code: 'P' }).success, false)
  assert.equal(menuPositionRowSchema.safeParse({ menu_code: 'M' }).success, false)
})

test('menu_positions: missing price_override → null', () => {
  assert.equal(menuPositionRowSchema.parse({ menu_code: 'M', position_code: 'P' }).price_override, null)
})

// ── position_components ──────────────────────────────────────
test('position_components: recipe row parses, German quantity, sort default', () => {
  const r = positionComponentRowSchema.parse({
    position_code: 'POS-0007',
    recipe_code: 'REC-0012',
    quantity: '0,5',
    unit_code: 'kg',
  })
  assert.equal(r.position_code, 'POS-0007')
  assert.equal(r.recipe_code, 'REC-0012')
  assert.equal(r.quantity, 0.5)
  assert.equal(r.sort_order, 0)
})

test('position_components: ingredient row parses', () => {
  const r = positionComponentRowSchema.parse({
    position_code: 'POS-0007',
    ingredient_code: 'ING-0003',
    quantity: 200,
    sort_order: 2,
  })
  assert.equal(r.ingredient_code, 'ING-0003')
  assert.equal(r.quantity, 200)
  assert.equal(r.sort_order, 2)
})

test('position_components: quantity blank → null (importer defaults to 1)', () => {
  assert.equal(positionComponentRowSchema.parse({ position_code: 'P', recipe_code: 'R' }).quantity, null)
})

test('position_components: position_code required', () => {
  assert.equal(positionComponentRowSchema.safeParse({ recipe_code: 'R', quantity: 1 }).success, false)
})
