// Tests for the MouseClick Produktbedarf CSV parser (lib/produktbedarf/parse.ts).
// Run: node --import ./tests/register.mjs --test tests/produktbedarf.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseProduktbedarfCsv, tokenizeDelimited, detectAddOn, detectNoDemand } from '@/lib/produktbedarf/parse'
import { normalizeName, scoreMatch, suggestMatch } from '@/lib/produktbedarf/match'

// Representative subset of a real export: semicolon-delimited, quoted, with a
// multi-line Aufträge field, an HTML entity, an "Optional zubuchbar" row and a
// "Stk" unit row.
const SAMPLE = [
  '"Produkt";"Langbezeichnung";"Menge";"Einheit";"Aufträge";"Klassifizierung"',
  '"Fingerfood Caesar";"FingerfoodCaesar&lsquo;s Salad / Parmesan";"205";"pax";" HZ Monika H L SSP_97 EW (97 pax)',
  ' Castlabs AV H ca 75pax abends (75 pax)',
  ' DGVS WS R L (DH) ca 35pax ganztägig (33 pax)";"Speisen"',
  '"BBQ Basic Menü 2026";"BBQ Basic Menü vegan / vegetarisch";"369";"pax";" Funke WS L H R (75 pax)',
  ' synaigy AV DHOLSSP ca 180 pax abends (180 pax)";"Speisen"',
  '"Trinkgeld";"TrinkgeldKleines Trinkgeld :)";"0";"";" Funke WS L H R ca 75pax tagsüber (0 )";"Optional zubuchbar"',
  '"Midnightsnack Chili sin/con...";"Midnightsnack Chili sin/con Carne";"97";"Stk";" HZ Monika H L SSP_97 EW (97 Stk)";"Speisen"',
  '',
].join('\n')

test('tokenizer keeps multi-line quoted fields in one cell', () => {
  const grid = tokenizeDelimited(SAMPLE, ';')
  // Header + 4 data rows (the trailing blank line produces no record).
  assert.equal(grid.filter((r) => r.some((c) => c.trim() !== '')).length, 5)
  // The Caesar row's Aufträge cell must contain all three events.
  const caesar = grid[1]
  assert.match(caesar[4], /97 pax/)
  assert.match(caesar[4], /75 pax/)
  assert.match(caesar[4], /33 pax/)
})

test('parses rows with totals, unit and classification', () => {
  const rows = parseProduktbedarfCsv(SAMPLE)
  assert.equal(rows.length, 4)

  const bbq = rows.find((r) => r.produkt === 'BBQ Basic Menü 2026')
  assert.ok(bbq)
  assert.equal(bbq!.menge, 369)
  assert.equal(bbq!.einheit, 'pax')
  assert.equal(bbq!.klassifizierung, 'Speisen')
  assert.equal(bbq!.istOptional, false)
  assert.equal(bbq!.auftragCount, 2)
})

test('flags optional/add-on lines and zero demand', () => {
  const rows = parseProduktbedarfCsv(SAMPLE)
  const trinkgeld = rows.find((r) => r.produkt === 'Trinkgeld')
  assert.ok(trinkgeld)
  assert.equal(trinkgeld!.menge, 0)
  assert.equal(trinkgeld!.istOptional, true)
})

test('detectAddOn erkennt MouseClick-Add-on-Zeilen am Namen', () => {
  assert.equal(detectAddOn('Add On Burrata Tomate', 'Add OnTomatensalat / Burrata'), true)
  assert.equal(detectAddOn('Add On Brisket', 'Add OnBrisket / Kimchi'), true)
  assert.equal(detectAddOn('Fingerfood 2025 6 Teile', 'Caesar Salad …'), false)
  assert.equal(detectAddOn('BBQ Basic Menü 2026', ''), false)
})

test('detectNoDemand erkennt Service-/Gebühr-/extern-Posten', () => {
  assert.equal(detectNoDemand('Tellergeld Torte Fingerfood', 'Tellergeld (Torte und Fingerfood) Nutzung von kleinen Tellern …'), true)
  assert.equal(detectNoDemand('Cateringauslöse Speisen', 'Cateringauslöse Speisen (tagsüber)'), true)
  assert.equal(detectNoDemand('Hochzeitstorte ab 30 Pax', 'Hochzeitstorte made by ZANE'), true)
  assert.equal(detectNoDemand('Dunkle Schokoladen-Cake-Pops', 'Cake-Pops made by ZANE auch vegan'), true)
  assert.equal(detectNoDemand('Fingerfood Caesar', "Caesar's Salad / Parmesan"), false)
  assert.equal(detectNoDemand('Kidsessen Chicken Nuggets', 'Chicken Nuggets mit Pommes und Ketchup'), false)
})

test('preserves non-pax units', () => {
  const rows = parseProduktbedarfCsv(SAMPLE)
  const snack = rows.find((r) => r.produkt.startsWith('Midnightsnack'))
  assert.ok(snack)
  assert.equal(snack!.einheit, 'Stk')
  assert.equal(snack!.menge, 97)
})

test('decodes HTML entities in long names', () => {
  const rows = parseProduktbedarfCsv(SAMPLE)
  const caesar = rows.find((r) => r.produkt === 'Fingerfood Caesar')
  assert.ok(caesar)
  assert.ok(!caesar!.langbezeichnung.includes('&lsquo;'))
  assert.match(caesar!.langbezeichnung, /Caesar‘s Salad/)
})

test('multi-line Aufträge is flattened to one string with all events', () => {
  const rows = parseProduktbedarfCsv(SAMPLE)
  const caesar = rows.find((r) => r.produkt === 'Fingerfood Caesar')!
  assert.equal(caesar.auftragCount, 3)
  assert.match(caesar.auftraege, /97 pax.*75 pax.*33 pax/)
})

// ── matcher (lib/produktbedarf/match.ts) ──────────────────────────

test('normalizeName folds umlauts and strips punctuation', () => {
  assert.equal(normalizeName('BBQ Basic Menü 2026'), 'bbq basic menue 2026')
  assert.equal(normalizeName('Frühstücks-/Pausensnack'), 'fruehstuecks pausensnack')
})

const MENUS = [
  { id: 'm-bbq', text: 'BBQ Basic Menü 2026 BBQ-2026' },
  { id: 'm-lunch', text: 'Lunch Hühnchen Blumenkohl LUN-01' },
  { id: 'm-caesar', text: 'Fingerfood Caesar Salad FF-CAE' },
]

test('suggestMatch finds the obvious menu', () => {
  const hit = suggestMatch('BBQ Basic Menü 2026 BBQ Basic Menü vegan', MENUS)
  assert.ok(hit)
  assert.equal(hit!.id, 'm-bbq')
})

test('suggestMatch returns null below threshold', () => {
  assert.equal(suggestMatch('Trinkgeld kleines Trinkgeld', MENUS), null)
})

test('scoreMatch is higher for the correct candidate', () => {
  const product = 'Fingerfood Caesar FingerfoodCaesar Salad Parmesan'
  assert.ok(scoreMatch(product, MENUS[2].text) > scoreMatch(product, MENUS[0].text))
})

// ── Produktbedarf → Produktion: Übernahme-Aggregation ──────────
import {
  aggregatePromotedItems,
  resolvePositionSelection,
  deriveBatchMeta,
  type PromoteOrderInput,
} from '@/lib/produktbedarf/promoteToProduction'

const order = (o: Partial<PromoteOrderInput>): PromoteOrderInput => ({
  matchedMenuId: 'menu-1',
  eventPax: 50,
  noDemand: false,
  selectedPositionIds: [],
  menuPositionIds: ['p1', 'p2', 'p3'],
  ...o,
})

test('resolvePositionSelection: Auswahl bleibt Auswahl', () => {
  assert.deepEqual(resolvePositionSelection(order({ selectedPositionIds: ['p2', 'p1'] })), ['p1', 'p2'])
})

test('resolvePositionSelection: Einzelposition (kein Teile-Count) bleibt Auswahl', () => {
  // Standalone-Zeile: eine gewählte Position, NICHT das ganze Menü.
  assert.deepEqual(resolvePositionSelection(order({ selectedPositionIds: ['p2'] })), ['p2'])
})

test('resolvePositionSelection: alle Positionen gewählt = ganzes Menü', () => {
  assert.deepEqual(resolvePositionSelection(order({ selectedPositionIds: ['p1', 'p2', 'p3'] })), [])
})

test('resolvePositionSelection: keine Auswahl = ganzes Menü', () => {
  assert.deepEqual(resolvePositionSelection(order({ selectedPositionIds: [] })), [])
})

test('aggregatePromotedItems überspringt No-Demand und Menü-lose Zeilen', () => {
  const result = aggregatePromotedItems([
    order({ noDemand: true }),
    order({ matchedMenuId: null }),
    order({ eventPax: 0 }),
  ])
  assert.equal(result.length, 0)
})

test('aggregatePromotedItems summiert gleiche (Menü + Auswahl), trennt verschiedene', () => {
  const result = aggregatePromotedItems([
    order({ eventPax: 50, selectedPositionIds: ['p1', 'p2'] }),
    order({ eventPax: 30, selectedPositionIds: ['p2', 'p1'] }), // selbe Auswahl → summiert
    order({ eventPax: 20, selectedPositionIds: ['p2', 'p3'] }), // andere Auswahl → eigene Zeile
  ])
  assert.equal(result.length, 2)
  const merged = result.find((r) => r.positionIds.join(',') === 'p1,p2')
  assert.equal(merged?.paxCount, 80)
  const other = result.find((r) => r.positionIds.join(',') === 'p2,p3')
  assert.equal(other?.paxCount, 20)
})

test('deriveBatchMeta liest Datumsbereich aus MouseClick-Dateinamen', () => {
  const meta = deriveBatchMeta('Produktbedarf_2026-07-01bis30.csv')
  assert.equal(meta.startDate, '2026-07-01')
  assert.equal(meta.endDate, '2026-07-30')
})
