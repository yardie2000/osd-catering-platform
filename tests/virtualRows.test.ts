// Tests für die Virtualisierungs-Fenstermathematik (hooks/use-virtual-rows.ts)
// Run: node --import ./tests/register.mjs --test tests/virtualRows.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { computeWindow } from '@/hooks/use-virtual-rows'

describe('computeWindow', () => {
  test('Anfang: oben am Scroll', () => {
    const w = computeWindow(0, 600, 50, 1000, 8)
    assert.equal(w.start, 0)
    assert.equal(w.padTop, 0)
    // sichtbar 12 + overscan
    assert.ok(w.end >= 12 && w.end <= 12 + 16)
    assert.equal(w.padBottom, (1000 - w.end) * 50)
  })

  test('Mitte: Fenster folgt dem Scroll', () => {
    const w = computeWindow(5000, 600, 50, 1000, 8)
    // floor(5000/50)=100, minus overscan 8 -> 92
    assert.equal(w.start, 92)
    assert.equal(w.padTop, 92 * 50)
    assert.ok(w.end > w.start)
  })

  test('Ende: end ist auf count begrenzt, padBottom 0', () => {
    const w = computeWindow(49_000, 600, 50, 1000, 8)
    assert.equal(w.end, 1000)
    assert.equal(w.padBottom, 0)
  })

  test('Gesamthöhe bleibt erhalten (padTop + Fensterhöhe + padBottom = count*rowHeight)', () => {
    const w = computeWindow(2500, 600, 50, 1000, 8)
    const windowHeight = (w.end - w.start) * 50
    assert.equal(w.padTop + windowHeight + w.padBottom, 1000 * 50)
  })

  test('leere Liste', () => {
    const w = computeWindow(0, 600, 50, 0, 8)
    assert.deepEqual(w, { start: 0, end: 0, padTop: 0, padBottom: 0 })
  })

  test('negativer Scroll wird geklemmt', () => {
    const w = computeWindow(-100, 600, 50, 1000, 8)
    assert.equal(w.start, 0)
    assert.equal(w.padTop, 0)
  })
})
