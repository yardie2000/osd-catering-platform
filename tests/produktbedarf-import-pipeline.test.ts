import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { parseProduktbedarfCsv } from '@/lib/produktbedarf/parse'
import {
  buildProduktbedarfImportDraft,
  detectVariant,
  matchMenu,
  parseAuftraege,
  reconstructSelectedItems,
  type ImportCatalogMenu,
} from '@/lib/produktbedarf/importPipeline'

const CATALOG: ImportCatalogMenu[] = [
  {
    id: 'm-fingerfood',
    menu_code: 'MENU_FINGERFOOD_2026',
    menu_name: 'FINGERFOOD ABENDS',
    category: 'Fingerfood',
    positions: [
      {
        id: 'p-caesar',
        position_code: 'POS-001',
        name: "Caesar's Salad - Romana Salatherzen | Parmesan | Teriyaki Sauce",
        recipeIds: ['r-caesar'],
      },
      {
        id: 'p-fish',
        position_code: 'POS-002',
        name: 'Fish & Chips | Avocado-Koriander Sauce',
        recipeIds: ['r-fish'],
      },
      {
        id: 'p-croquetas',
        position_code: 'POS-003',
        name: 'Croquetas - Champignons | Bechamel',
        recipeIds: ['r-croquetas'],
      },
      {
        id: 'p-caponata',
        position_code: 'POS-004',
        name: 'Caponata - Aubergine | Sellerie | Kapern | Oliven | Pinienkerne',
        recipeIds: ['r-caponata'],
      },
      {
        id: 'p-brownie',
        position_code: 'POS-005',
        name: 'Dunkler Brownie',
        recipeIds: ['r-brownie'],
      },
      {
        id: 'p-tarte',
        position_code: 'POS-006',
        name: 'Waldbeeren Tarte | Cashew-Creme',
        recipeIds: ['r-tarte'],
      },
      {
        id: 'p-oliven',
        position_code: 'POS-007',
        name: 'Oliven & Pickles',
        recipeIds: ['r-pickles'],
      },
    ],
  },
  {
    id: 'm-grab',
    menu_code: 'MENU_GRABANDGO_2026',
    menu_name: 'GRAB AND GO LUNCH',
    category: 'Lunch',
    positions: [
      {
        id: 'p-wrap',
        position_code: 'POS-010',
        name: 'Frischer Wrap | Gemüse der Saison | Salat | Hähnchen oder Tofu | Kräutersauce',
        recipeIds: ['r-wrap'],
      },
      { id: 'p-obst', position_code: 'POS-011', name: 'Hand Obst', recipeIds: ['r-obst'] },
      { id: 'p-blech', position_code: 'POS-012', name: 'Blechkuchen', recipeIds: ['r-blech'] },
    ],
  },
]

describe('parseAuftraege', () => {
  test('splits one CSV product row into separate event orders', () => {
    const orders = parseAuftraege(
      ' FMC WSAV DHOL ca 15pax ganztägig (14 pax) SteffenMau DH AV ca 60pax abends (60 pax)',
      74,
      'pax',
    )
    assert.equal(orders.length, 2)
    assert.equal(orders[0].eventName, 'FMC WSAV DHOL ca 15pax ganztägig')
    assert.equal(orders[0].pax, 14)
    assert.equal(orders[1].pax, 60)
  })

  test('keeps parenthesized non-count text inside event names', () => {
    const orders = parseAuftraege('DGVS WS R L (DH) ca 35pax ganztägig (33 pax)', 33, 'pax')
    assert.equal(orders.length, 1)
    assert.match(orders[0].eventName, /\(DH\)/)
    assert.equal(orders[0].pax, 33)
  })
})

describe('menu and variant matching', () => {
  test('matches MouseClick product to sellable menu, not recipes', () => {
    const result = matchMenu('Fingerfood 2025 6 Teile', CATALOG)
    assert.equal(result.menu?.id, 'm-fingerfood')
    assert.equal(result.needsReview, false)
  })

  test('detects Teile variants', () => {
    const variant = detectVariant('Fingerfood 2025 6 Teile')
    assert.equal(variant.label, '6 Teile')
    assert.equal(variant.itemCount, 6)
  })
})

describe('selected position reconstruction', () => {
  test('stores only positions found in the customer long description', () => {
    const menu = CATALOG[0]
    const selected = reconstructSelectedItems(
      "Fingerfood 2025 6 Teile Caesar's Salad Fish'n'Chips Croquetas Caponata Dunkler Brownie Waldbeeren Minitarte",
      menu,
    )
    assert.deepEqual(
      selected.map((item) => item.matchedMenuItemId).sort(),
      ['p-brownie', 'p-caesar', 'p-caponata', 'p-croquetas', 'p-fish', 'p-tarte'].sort(),
    )
    assert.ok(!selected.some((item) => item.matchedMenuItemId === 'p-oliven'))
  })

  test('unmatched descriptions stay in review instead of being discarded', () => {
    const selected = reconstructSelectedItems('Unbekannte Sonderposition mit Beschreibung', CATALOG[0])
    assert.equal(selected.length, 1)
    assert.equal(selected[0].matchedMenuItemId, null)
    assert.equal(selected[0].needsReview, true)
  })
})

describe('full import draft', () => {
  const CSV = [
    '"Produkt";"Langbezeichnung";"Menge";"Einheit";"Aufträge";"Klassifizierung"',
    "\"Fingerfood 2025 6 Teile\";\"Fingerfood 2025 6 Teile Caesar´s Salad Fish'n'Chips Croquetas Caponata Dunkler Brownie Waldbeeren Minitarte\";\"74\";\"pax\";\" Event A (14 pax)\n Event B (60 pax)\";\"Speisen\"",
    '',
  ].join('\n')

  test('creates one event order per Auftrag', () => {
    const rows = parseProduktbedarfCsv(CSV)
    const draft = buildProduktbedarfImportDraft(rows, CATALOG)
    assert.equal(draft.events.length, 2)
    assert.equal(draft.totalOrders, 2)
    assert.equal(draft.events.find((event) => event.eventName === 'Event A')?.pax, 14)
  })

  test('variant count mismatch becomes needs_review', () => {
    const rows = parseProduktbedarfCsv(CSV)
    const draft = buildProduktbedarfImportDraft(rows, CATALOG)
    for (const event of draft.events) {
      assert.equal(event.status, 'matched')
      assert.equal(event.orders[0].selectedItems.length, 6)
    }

    const mismatchRows = parseProduktbedarfCsv(CSV.replace('Waldbeeren Minitarte', ''))
    const mismatchDraft = buildProduktbedarfImportDraft(mismatchRows, CATALOG)
    assert.equal(mismatchDraft.events[0].status, 'needs_review')
    assert.equal(mismatchDraft.events[0].orders[0].selectedItems.length, 6)
    assert.equal(mismatchDraft.events[0].orders[0].selectedItems.at(-1)?.matchedMenuItemId, null)
    assert.match(mismatchDraft.events[0].warnings.join(' '), /Mindestens eine Position/)
  })
})
