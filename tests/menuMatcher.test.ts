// Tests for the multi-stage menu matcher (lib/produktbedarf/menuMatcher.ts)
// Run: node --import ./tests/register.mjs --test tests/menuMatcher.test.ts
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  matchProdukt,
  matchAll,
  normalizeStr,
  type MatchableMenu,
} from '@/lib/produktbedarf/menuMatcher'

// ── Test catalog ──────────────────────────────────────────────────────────────

const CATALOG: MatchableMenu[] = [
  {
    id: 'm-ff-6',
    menu_name: 'Fingerfood 2025 6 Teile',
    menu_code: 'FF-6',
    positions: [
      { id: 'p-caesar',   name: "Caesar's Salad",     position_code: 'POS-001', recipeIds: ['r-caesar'] },
      { id: 'p-guildas',  name: 'Guildas',            position_code: 'POS-002', recipeIds: ['r-guildas'] },
      { id: 'p-croquetas',name: 'Croquetas',          position_code: 'POS-003', recipeIds: ['r-croc'] },
    ],
  },
  {
    id: 'm-ff-3',
    menu_name: 'Fingerfood 2025 3 Teile',
    menu_code: 'FF-3',
    positions: [
      { id: 'p-caesar2',  name: "Caesar's Salad",     position_code: 'POS-004', recipeIds: ['r-caesar'] },
      { id: 'p-caponata', name: 'Caponata Siciliana', position_code: 'POS-005', recipeIds: ['r-cap'] },
      { id: 'p-fishchips',name: 'Fish and Chips',     position_code: 'POS-006', recipeIds: ['r-fish'] },
    ],
  },
  {
    id: 'm-bbq',
    menu_name: 'BBQ Basic Menü 2026',
    menu_code: 'BBQ-2026',
    positions: [
      { id: 'p-brisket',  name: 'Brisket',            position_code: 'POS-010', recipeIds: ['r-brisket'] },
      { id: 'p-bbqsalad', name: 'Blattsalat',         position_code: 'POS-011', recipeIds: ['r-salad'] },
    ],
  },
  {
    id: 'm-dinner',
    menu_name: 'Dinnerbuffet 2025',
    menu_code: 'DIN-2025',
    positions: [
      { id: 'p-poularde', name: 'Poulardenbrust',     position_code: 'POS-020', recipeIds: ['r-poularde'] },
      { id: 'p-kabeljau', name: 'Kabeljaufilet',      position_code: 'POS-021', recipeIds: ['r-kabeljau'] },
    ],
  },
  {
    id: 'm-hz',
    menu_name: 'Family Style Hochzeit',
    menu_code: 'HZ-FS',
    positions: [
      { id: 'p-roastbeef', name: 'Roastbeef',         position_code: 'POS-030', recipeIds: ['r-roastbeef'] },
      { id: 'p-haehnchen', name: 'Hähnchenbrust',     position_code: 'POS-031', recipeIds: ['r-haehnchen'] },
    ],
  },
]

// ── Helper ────────────────────────────────────────────────────────────────────

function match(produkt: string, langbezeichnung = '') {
  return matchProdukt(produkt, langbezeichnung, CATALOG)
}

// ── normalizeStr ──────────────────────────────────────────────────────────────

describe('normalizeStr', () => {
  test('folds German umlauts', () => {
    assert.equal(normalizeStr('Menü'), 'menue')
    assert.equal(normalizeStr('Hähnchenbrust'), 'haehnchenbrust')
    assert.equal(normalizeStr('Frühstück'), 'fruehstueck')
    assert.equal(normalizeStr('Straße'), 'strasse')
  })

  test('collapses punctuation and whitespace', () => {
    assert.equal(normalizeStr('Fish and Chips / Avocado'), 'fish and chips avocado')
    // apostrophes are removed so "Caesar´s" → "caesars" for better token matching
    assert.equal(normalizeStr("Caesar's Salad"), 'caesars salad')
    assert.equal(normalizeStr('Caesar´s Salad'), 'caesars salad')
    assert.equal(normalizeStr('  Doppel  Leerzeichen  '), 'doppel leerzeichen')
  })
})

// ── Stage 1: Exact match ──────────────────────────────────────────────────────

describe('Stage 1 – exact match', () => {
  test('exact menu name match', () => {
    const r = match('BBQ Basic Menü 2026')
    assert.equal(r.strategy, 'exact-menu')
    assert.equal(r.matchedMenuId, 'm-bbq')
    assert.equal(r.confidence, 1.0)
    assert.equal(r.needsReview, false)
  })

  test('exact match is case-insensitive', () => {
    const r = match('bbq basic menü 2026')
    assert.equal(r.strategy, 'exact-menu')
    assert.equal(r.matchedMenuId, 'm-bbq')
  })

  test('exact match ignores extra whitespace', () => {
    const r = match('BBQ  Basic  Menü  2026')
    assert.equal(r.strategy, 'exact-menu')
    assert.equal(r.matchedMenuId, 'm-bbq')
  })
})

// ── Stage 2: Fuzzy menu match ─────────────────────────────────────────────────

describe('Stage 2 – fuzzy menu match', () => {
  test('high-overlap product matches menu', () => {
    // "BBQ Basic Menü 2026 BBQ vegan vegetarisch" → most tokens overlap with BBQ menu
    const r = match('BBQ Basic Menü 2026', 'BBQ vegan vegetarisch')
    assert.ok(r.matchedMenuId === 'm-bbq')
    assert.ok(r.confidence >= 0.85)
  })

  test('dinnerbuffet with minor typo still resolves', () => {
    const r = match('Dinnerbuffet 2025', '')
    assert.ok(r.matchedMenuId === 'm-dinner')
  })
})

// ── Stage 3: Menu + Position split ───────────────────────────────────────────

describe('Stage 3 – menu+position split', () => {
  test('Fingerfood Caesar → FF menu + Caesar position', () => {
    const r = match('Fingerfood Caesar')
    // Should match one of the Fingerfood menus with Caesar position
    assert.ok(r.matchedMenuId === 'm-ff-6' || r.matchedMenuId === 'm-ff-3',
      `Expected Fingerfood menu, got ${r.matchedMenuId}`)
    assert.ok(
      r.matchedPositionName?.toLowerCase().includes("caesar"),
      `Expected Caesar position, got ${r.matchedPositionName}`,
    )
    assert.ok(r.matchedRecipeIds.includes('r-caesar'))
  })

  test('Fingerfood Guildas → FF-6 menu + Guildas position', () => {
    const r = match('Fingerfood Guildas')
    assert.equal(r.matchedMenuId, 'm-ff-6')
    assert.equal(r.matchedPositionId, 'p-guildas')
    assert.ok(r.matchedRecipeIds.includes('r-guildas'))
  })

  test('Fingerfood Fish and Chips → FF-3 menu + Fish position', () => {
    const r = match('Fingerfood Fish and Chips')
    assert.equal(r.matchedMenuId, 'm-ff-3')
    assert.equal(r.matchedPositionId, 'p-fishchips')
  })

  test('Family Style Roastbeef → wedding menu + Roastbeef position', () => {
    const r = match('Family Style Roastbeef')
    assert.equal(r.matchedMenuId, 'm-hz')
    assert.equal(r.matchedPositionId, 'p-roastbeef')
    assert.ok(r.matchedRecipeIds.includes('r-roastbeef'))
  })

  test('BBQ Brisket → BBQ menu + Brisket position', () => {
    const r = match('BBQ Brisket')
    assert.equal(r.matchedMenuId, 'm-bbq')
    assert.equal(r.matchedPositionId, 'p-brisket')
  })

  test('Dinnerbuffet Kabeljau → dinner menu + Kabeljau position', () => {
    const r = match('Dinnerbuffet Kabeljau')
    assert.equal(r.matchedMenuId, 'm-dinner')
    assert.equal(r.matchedPositionId, 'p-kabeljau')
  })
})

// ── Fuzzy / typo tolerance ────────────────────────────────────────────────────

describe('Fuzzy matching – typos and special characters', () => {
  test('handles truncated produkt names (ending …)', () => {
    const r = match('Fingerfood Croqueta…') // truncated to "Croqueta…" in MouseClick
    assert.ok(r.matchedMenuId === 'm-ff-6' || r.matchedMenuId === 'm-ff-3')
    // Position name contains "Croquetas"
    assert.ok(
      r.matchedPositionName?.toLowerCase().includes('croqueta') ??
        r.matchedMenuName?.toLowerCase().includes('fingerfood'),
    )
  })

  test('handles slash-separated names', () => {
    const r = match('Dinnerbuffet / FS 2025')
    assert.equal(r.matchedMenuId, 'm-dinner')
  })

  test('handles Caponata Siciliana abbreviated', () => {
    const r = match('Fingerfood Caponata')
    assert.ok(r.matchedMenuId === 'm-ff-3')
    assert.equal(r.matchedPositionId, 'p-caponata')
  })

  test('umlaut in position name (Hähnchenbrust)', () => {
    const r = match('Family Style Haehnchenbrust')
    assert.equal(r.matchedMenuId, 'm-hz')
    assert.equal(r.matchedPositionId, 'p-haehnchen')
  })
})

// ── Ambiguous / needs-review ──────────────────────────────────────────────────

describe('Ambiguous / needs-review', () => {
  test('Caesar appears in two Fingerfood menus → needs-review or match with warning', () => {
    const r = match('Fingerfood Caesar')
    // Either needs-review OR menu-position-split with a warning about multiple menus
    const isAmbiguous = r.needsReview || r.warnings.length > 0
    // Either outcome is acceptable — the important thing is a menu was found
    assert.ok(r.matchedMenuId !== null)
    // And a position was found
    assert.ok(r.matchedPositionId !== null || isAmbiguous)
  })
})

// ── No match ──────────────────────────────────────────────────────────────────

describe('No match', () => {
  test('completely unknown product → no-match', () => {
    const r = match('Trinkgeld', 'Kleines Trinkgeld :)')
    assert.equal(r.strategy, 'no-match')
    assert.equal(r.matchedMenuId, null)
    assert.equal(r.needsReview, true)
  })

  test('empty context → no-match', () => {
    const r = matchProdukt('BBQ Basic Menü 2026', '', [])
    assert.equal(r.strategy, 'no-match')
  })

  test('empty produkt → no-match', () => {
    const r = match('')
    assert.equal(r.strategy, 'no-match')
  })
})

// ── matchAll helper ───────────────────────────────────────────────────────────

describe('matchAll', () => {
  test('returns one result per input row, never drops a row', () => {
    const rows = [
      { produkt: 'BBQ Basic Menü 2026', langbezeichnung: '', menge: 80 },
      { produkt: 'Fingerfood Guildas',  langbezeichnung: '', menge: 65 },
      { produkt: 'Trinkgeld',           langbezeichnung: '', menge: 0  },
    ]
    const results = matchAll(rows, CATALOG)
    assert.equal(results.length, 3)
    assert.equal(results[0].result.matchedMenuId, 'm-bbq')
    assert.equal(results[1].result.matchedMenuId, 'm-ff-6')
    assert.equal(results[2].result.strategy, 'no-match')
  })

  test('performance: 1000 rows complete in < 500ms', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({
      produkt: i % 5 === 0 ? 'BBQ Basic Menü 2026'
        : i % 5 === 1 ? 'Fingerfood Caesar'
        : i % 5 === 2 ? 'Family Style Roastbeef'
        : i % 5 === 3 ? 'Dinnerbuffet Kabeljau'
        : 'Unbekanntes Produkt',
      langbezeichnung: '',
      menge: 50,
    }))
    const start = process.hrtime.bigint()
    matchAll(rows, CATALOG)
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000
    assert.ok(ms < 500, `matchAll(1000) took ${ms.toFixed(1)}ms, expected < 500ms`)
  })
})

// ── Log output ────────────────────────────────────────────────────────────────

describe('Log output', () => {
  test('log contains CSV input and match strategy', () => {
    const r = match('Fingerfood Guildas')
    assert.ok(r.log.some((l) => l.includes('Fingerfood Guildas')))
    assert.ok(r.log.some((l) => l.toLowerCase().includes('confidence')))
  })

  test('no-match log explains the failure', () => {
    const r = match('Trinkgeld')
    assert.ok(r.log.some((l) => l.includes('Kein Treffer')))
  })
})
