import type { ProduktbedarfRow } from './parse'

export const AUTO_MATCH_THRESHOLD = 0.85

export type ProduktbedarfAuftrag = {
  eventName: string
  pax: number
  unit: string
  rawText: string
}

export type ImportCatalogRecipe = {
  id: string
  recipe_code?: string | null
  name?: string | null
}

export type ImportCatalogPosition = {
  id: string
  position_code: string | null
  name: string
  isAddOn?: boolean
  recipeIds: string[]
  recipes?: ImportCatalogRecipe[]
}

export type ImportCatalogMenu = {
  id: string
  menu_code: string
  menu_name: string
  category: string | null
  positions: ImportCatalogPosition[]
}

export type ExpectedItemCountMatch = {
  itemCount: number | null
  confidence: number
}

export type MenuMatch = {
  menu: ImportCatalogMenu | null
  confidence: number
  strategy: 'exact' | 'normalized' | 'alias' | 'token' | 'fuzzy' | 'no-match'
  needsReview: boolean
  warnings: string[]
}

export type SelectedPositionMatch = {
  rawPositionText: string
  originalText: string
  matchedMenuItemId: string | null
  matchedRecipeId: string | null
  matchedPositionName: string | null
  confidence: number
  needsReview: boolean
}

export type ImportedOrderDraft = {
  sourceRowNumber: number
  produkt: string
  langbezeichnung: string
  originalImportText: string
  menge: number
  einheit: string
  klassifizierung: string
  auftraege: string
  eventName: string
  eventPax: number
  rawAuftragText: string
  menuMatch: MenuMatch
  expectedItemCount: ExpectedItemCountMatch
  selectedItems: SelectedPositionMatch[]
  status: 'matched' | 'needs_review'
  warnings: string[]
}

export type ImportedEventDraft = {
  eventName: string
  normalizedEventName: string
  pax: number
  orders: ImportedOrderDraft[]
  warnings: string[]
  status: 'matched' | 'needs_review'
}

export type ProduktbedarfImportDraft = {
  events: ImportedEventDraft[]
  totalRows: number
  totalOrders: number
  warnings: string[]
}

const HTML_ENTITIES: Record<string, string> = {
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&nbsp;': ' ',
}

function decodeEntities(value: string): string {
  return value.replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m] ?? m)
}

export function normalizeText(value: string): string {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/\u00e4/g, 'ae')
    .replace(/\u00f6/g, 'oe')
    .replace(/\u00fc/g, 'ue')
    .replace(/\u00df/g, 'ss')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''´`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP = new Set([
  'und', 'oder', 'mit', 'ohne', 'auch', 'der', 'die', 'das', 'den', 'dem',
  'pax', 'ca', 'circa', 'menu', 'menue', '2025', '2026', 'auswahl', 'preis',
  'je', 'nach', 'als', 'style', 'serviert', 'vegan', 'vegetarisch', 'm', 'o',
  'produkt', 'langbezeichnung', 'menge', 'einheit', 'auftraege', 'klassifizierung',
])

function tokenList(value: string): string[] {
  const normalized = normalizeText(value)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t))
  const expanded: string[] = []
  for (const token of normalized) {
    expanded.push(token)
    if (token.endsWith('smenue')) expanded.push(token.slice(0, -6))
    if (token.endsWith('smenu')) expanded.push(token.slice(0, -5))
    if (token.endsWith('menue')) expanded.push(token.slice(0, -5))
    if (token.endsWith('menu')) expanded.push(token.slice(0, -4))
    if (token.endsWith('snacks')) expanded.push(token.slice(0, -6))
    if (token.endsWith('snack')) expanded.push(token.slice(0, -5))
  }
  return [...new Set(expanded.filter((t) => t.length > 1 && !STOP.has(t)))]
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array<number>(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, prev.length, ...curr)
  }
  return prev[b.length]
}

function charSimilarity(a: string, b: string): number {
  const na = normalizeText(a)
  const nb = normalizeText(b)
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  if (na === nb) return 1
  return 1 - levenshtein(na, nb) / Math.max(na.length, nb.length)
}

function tokenSimilarity(sourceToken: string, candidateToken: string): number {
  if (sourceToken === candidateToken) return 1
  if (sourceToken.length >= 4 && candidateToken.length >= 4) {
    if (sourceToken.includes(candidateToken) || candidateToken.includes(sourceToken)) return 0.94
  }
  return 1 - levenshtein(sourceToken, candidateToken) / Math.max(sourceToken.length, candidateToken.length)
}

function tokenCoverage(source: string, candidate: string): number {
  const sourceTokens = tokenList(source)
  const candidateTokens = tokenList(candidate)
  if (sourceTokens.length === 0 || candidateTokens.length === 0) return 0
  let score = 0
  for (const token of candidateTokens) {
    const best = sourceTokens.reduce((max, sourceToken) => Math.max(max, tokenSimilarity(sourceToken, token)), 0)
    if (best >= 0.84) score += best
  }
  return score / candidateTokens.length
}

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

export function parseAuftraege(raw: string, fallbackPax: number, fallbackUnit: string): ProduktbedarfAuftrag[] {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) {
    return [{
      eventName: 'Unbekanntes Event',
      pax: fallbackPax,
      unit: fallbackUnit || 'pax',
      rawText: '',
    }]
  }

  const matches = [...text.matchAll(/\((\d+(?:[,.]\d+)?)\s*([a-zA-ZÄÖÜäöüß.]*)\)/g)]
    .filter((m) => {
      const unit = (m[2] || '').toLowerCase()
      return unit === '' || /^(pax|stk|st|stück|stueck|personen?)\.?$/.test(unit)
    })

  if (matches.length === 0) {
    return [{
      eventName: text,
      pax: fallbackPax,
      unit: fallbackUnit || 'pax',
      rawText: text,
    }]
  }

  const orders: ProduktbedarfAuftrag[] = []
  let cursor = 0
  for (const match of matches) {
    const rawText = text.slice(cursor, match.index! + match[0].length).trim()
    const eventName = text.slice(cursor, match.index).trim() || 'Unbekanntes Event'
    const pax = Number.parseFloat(match[1].replace(',', '.'))
    orders.push({
      eventName,
      pax: Number.isFinite(pax) ? pax : 0,
      unit: match[2] || fallbackUnit || 'pax',
      rawText,
    })
    cursor = match.index! + match[0].length
  }
  return orders
}

export function detectExpectedItemCount(productText: string): ExpectedItemCountMatch {
  const text = decodeEntities(productText)
  const teile = text.match(/(\d+)\s*teile?/i) ?? text.match(/(\d+)\s*teile?/i)
  if (teile) {
    const count = Number.parseInt(teile[1], 10)
    return { itemCount: count, confidence: 1 }
  }
  return { itemCount: null, confidence: 0 }
}

function productWithoutVariant(value: string): string {
  return normalizeText(value)
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\b\d+\s*teile?\b/g, ' ')
    .replace(/\b(fs|flying|buffet|family|style|sharing|plates|auswahl)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildOriginalImportText(row: ProduktbedarfRow): string {
  return [
    `Produkt: ${row.produkt}`,
    `Langbezeichnung: ${row.langbezeichnung}`,
    `Menge: ${row.menge}`,
    `Mengenquelle: ${row.mengenQuelle ?? 'nicht gefunden'}`,
    `Einheit: ${row.einheit}`,
    `Auftraege: ${row.auftraege}`,
    `Klassifizierung: ${row.klassifizierung}`,
  ].join('\n')
}

function aliasesForMenu(menu: ImportCatalogMenu): string[] {
  const base = [menu.menu_name, menu.menu_code, menu.category ?? '']
  const n = normalizeText(`${menu.menu_name} ${menu.category ?? ''}`)
  if (n.includes('fingerfood')) base.push('fingerfood', 'fingerfood abends', 'fingerfood 2025')
  if (n.includes('fruhstuck') || n.includes('fruehstueck') || n.includes('pausen')) {
    base.push(
      'fruehstueck',
      'fruehstuecksmenue',
      'fruehstuecks menu',
      'fruehstuecks menue',
      'fruehstueckssnacks',
      'fruehstuecks pausensnacks',
      'fruehstueck pause',
      'pausensnacks',
      'pausen snacks',
      'pausen fruehstueckssnacks',
    )
  }
  if (n.includes('grab')) base.push('grabngo', 'grab n go', 'grab and go', "grab'n'go")
  if (n.includes('lunch')) base.push('lunch', 'lunch 2025', 'lunch fs buffet')
  if (n.includes('abend')) base.push('abendmenu', 'abendmenue', 'dinnerbuffet', 'dinner buffet', 'dinner', 'family style', 'sharing plates')
  if (n.includes('bbq')) base.push('bbq', 'bbq menu', 'bbq menue')
  if (n.includes('sommer')) base.push('sommermenu', 'sommermenue', 'osd sommermenu', 'osd sommermenue')
  if (n.includes('hochzeit')) base.push('hochzeit', 'hochzeitsmenu', 'hochzeitsmenue')
  if (n.includes('mitternacht')) base.push('mitternachtssnack', 'mitternacht snacks', 'midnightsnack', 'midnight snack')
  return uniq(base)
}

export function matchMenu(productText: string, catalog: ImportCatalogMenu[]): MenuMatch {
  const query = productWithoutVariant(productText)
  if (!query || catalog.length === 0) {
    return { menu: null, confidence: 0, strategy: 'no-match', needsReview: true, warnings: ['Kein Menu-Katalog geladen'] }
  }

  type CandidateScore = {
    menu: ImportCatalogMenu
    score: number
    strategy: MenuMatch['strategy']
  }

  const candidates: CandidateScore[] = []
  const queryNorm = normalizeText(productText)
  for (const menu of catalog) {
    for (const alias of aliasesForMenu(menu)) {
      const aliasNorm = productWithoutVariant(alias)
      if (!aliasNorm) continue

      let score = 0
      let strategy: MenuMatch['strategy'] = 'fuzzy'
      const aliasTokens = tokenList(aliasNorm)
      const exactPhrase = aliasNorm.length >= 4 && queryNorm.includes(aliasNorm)
      if (query === aliasNorm) {
        score = 1
        strategy = 'exact'
      } else if (exactPhrase) {
        score = aliasTokens.length <= 1 ? 0.9 : 0.98
        strategy = 'alias'
      } else if (aliasNorm.includes(query)) {
        score = 0.95
        strategy = 'alias'
      } else {
        const coverage = tokenCoverage(query, aliasNorm)
        const fuzzy = charSimilarity(query, aliasNorm) * (aliasTokens.length <= 1 ? 0.72 : 0.82)
        const menuNameBoost = alias === menu.menu_name ? 0.05 : 0
        const codePenalty = alias === menu.menu_code ? -0.08 : 0
        score = Math.max(coverage, fuzzy) + menuNameBoost + codePenalty
        strategy = coverage >= fuzzy ? 'token' : 'fuzzy'
      }

      candidates.push({
        menu,
        score: Math.max(0, Math.min(1, score)),
        strategy,
      })
    }
  }

  const bestByMenu = [...candidates.reduce((map, candidate) => {
    const existing = map.get(candidate.menu.id)
    if (!existing || candidate.score > existing.score) map.set(candidate.menu.id, candidate)
    return map
  }, new Map<string, CandidateScore>()).values()].sort((a, b) => b.score - a.score)

  const best = bestByMenu[0] ?? null
  if (!best) {
    return { menu: null, confidence: 0, strategy: 'no-match', needsReview: true, warnings: ['Kein passendes Menu gefunden'] }
  }

  const runnerUp = bestByMenu[1] ?? null
  const ambiguous = Boolean(
    runnerUp &&
    best.score < 0.98 &&
    runnerUp.score >= AUTO_MATCH_THRESHOLD &&
    best.score - runnerUp.score < 0.08,
  )
  const needsReview = best.score < AUTO_MATCH_THRESHOLD || ambiguous
  return {
    menu: needsReview ? null : best.menu,
    confidence: best.score,
    strategy: best.strategy,
    needsReview,
    warnings: needsReview
      ? [
          ambiguous
            ? `Mehrere aehnliche Menu-Treffer: ${best.menu.menu_name} (${Math.round(best.score * 100)} Prozent), ${runnerUp?.menu.menu_name} (${Math.round((runnerUp?.score ?? 0) * 100)} Prozent)`
            : `Menu-Treffer unter ${Math.round(AUTO_MATCH_THRESHOLD * 100)} Prozent: ${best.menu.menu_name}`,
        ]
      : [],
  }
}

function aliasesForPosition(position: ImportCatalogPosition): string[] {
  const name = position.name
  const firstPipe = name.split('|')[0]
  const firstDash = firstPipe.split(/\s[-–]\s/)[0]
  const aliases = [name, firstPipe, firstDash]

  const n = normalizeText(name)
  if (n.includes('fish') && n.includes('chips')) aliases.push("Fish'n'Chips", 'Fish and Chips', 'Fish & Chips')
  if (n.includes('caesar')) aliases.push("Caesar's Salad", 'Caesar Salad', 'Caesar')
  if (n.includes('oliven') || n.includes('olive')) aliases.push('Oliven & Pickles', 'Olive & Pickles', 'home-pickled Gemüse')
  if (n.includes('waldbeeren')) aliases.push('Waldbeeren Tarte', 'Waldbeeren Minitarte', 'Waldbeerentarte')
  if (n.includes('blechkuchen')) aliases.push('Blechkuchen', 'Cookies')
  if (n.includes('hand obst')) aliases.push('Handobst', 'Hand Obst')
  if (n.includes('wrap')) aliases.push('Wrap', 'Frischer Wrap')
  return uniq(aliases)
}

function matchPositionInText(langbezeichnung: string, position: ImportCatalogPosition): SelectedPositionMatch | null {
  const sourceNorm = normalizeText(langbezeichnung)
  const positionNorm = normalizeText(position.name)

  if (positionNorm.includes('mit haehnchen') && !/\b(mit|m)\s*haehnchen\b/.test(sourceNorm)) {
    return null
  }
  if (positionNorm.includes('ohne haehnchen') && !/\b(ohne|o)\s*haehnchen\b/.test(sourceNorm)) {
    return null
  }
  if (positionNorm.includes('ohne haehnchen') && /\b(mit|m)\s*haehnchen\b/.test(sourceNorm)) {
    return null
  }

  let best: { alias: string; score: number } | null = null

  for (const alias of aliasesForPosition(position)) {
    const aliasNorm = normalizeText(alias)
    if (!aliasNorm) continue

    let score = 0
    if (sourceNorm.includes(aliasNorm)) {
      score = aliasNorm.length < 5 ? 0.88 : 1
    } else {
      const coverage = tokenCoverage(langbezeichnung, alias)
      const tokenCount = tokenList(alias).length
      if (coverage === 1 && tokenCount >= 2) score = 0.92
      else if (coverage >= 0.8 && tokenCount >= 3) score = 0.88
      else score = Math.max(0, coverage * 0.82)
    }

    if (!best || score > best.score) best = { alias, score }
  }

  if (!best || best.score < AUTO_MATCH_THRESHOLD) return null

  return {
    rawPositionText: best.alias,
    originalText: langbezeichnung,
    matchedMenuItemId: position.id,
    matchedRecipeId: position.recipeIds[0] ?? null,
    matchedPositionName: position.name,
    confidence: Math.min(1, best.score),
    needsReview: best.score < AUTO_MATCH_THRESHOLD || position.recipeIds.length === 0,
  }
}

function uniqPositions(positions: ImportCatalogPosition[]): ImportCatalogPosition[] {
  const seen = new Set<string>()
  const unique: ImportCatalogPosition[] = []
  for (const position of positions) {
    if (seen.has(position.id)) continue
    seen.add(position.id)
    unique.push(position)
  }
  return unique
}

function suppressGenericCaesarDuplicates(matches: SelectedPositionMatch[]): SelectedPositionMatch[] {
  const hasSpecificCaesar = matches.some((item) => {
    const name = normalizeText(item.matchedPositionName ?? '')
    return name.includes('caesar') && (name.includes('mit haehnchen') || name.includes('ohne haehnchen'))
  })
  if (!hasSpecificCaesar) return matches
  return matches.filter((item) => {
    const name = normalizeText(item.matchedPositionName ?? '')
    return !(name.includes('caesar') && name.includes('m o haehnchen'))
  })
}

export function reconstructSelectedItems(langbezeichnung: string, menu: ImportCatalogMenu | null): SelectedPositionMatch[] {
  if (!menu) {
    return [{
      rawPositionText: langbezeichnung,
      originalText: langbezeichnung,
      matchedMenuItemId: null,
      matchedRecipeId: null,
      matchedPositionName: null,
      confidence: 0,
      needsReview: true,
    }]
  }

  const matches = suppressGenericCaesarDuplicates(menu.positions
    .map((position) => matchPositionInText(langbezeichnung, position))
    .filter((match): match is SelectedPositionMatch => Boolean(match))
    .sort((a, b) => b.confidence - a.confidence))

  if (matches.length === 0) {
    return [{
      rawPositionText: langbezeichnung,
      originalText: langbezeichnung,
      matchedMenuItemId: null,
      matchedRecipeId: null,
      matchedPositionName: null,
      confidence: 0,
      needsReview: true,
    }]
  }

  return matches
}

export function reconstructAddOnItems(langbezeichnung: string, catalog: ImportCatalogMenu[]): SelectedPositionMatch[] {
  const addOnPositions = uniqPositions(catalog.flatMap((menu) => menu.positions.filter((position) => position.isAddOn)))
  const matches = addOnPositions
    .map((position) => matchPositionInText(langbezeichnung, position))
    .filter((match): match is SelectedPositionMatch => Boolean(match))
    .sort((a, b) => b.confidence - a.confidence)

  if (matches.length === 0) {
    return [{
      rawPositionText: langbezeichnung,
      originalText: langbezeichnung,
      matchedMenuItemId: null,
      matchedRecipeId: null,
      matchedPositionName: null,
      confidence: 0,
      needsReview: true,
    }]
  }

  return matches
}

/**
 * Matcht den Langtext gegen ALLE Positionen des Katalogs (menüübergreifend).
 * Dient der Erkennung von Einzel-Positions-Zeilen ("Fingerfood Caesar",
 * "Fingerfood Guildas" …): trifft der Text genau EINE Position, ist es eine
 * Einzelposition; trifft er mehrere, ist es ein (Voll-)Menü.
 */
export function matchAllPositions(langbezeichnung: string, catalog: ImportCatalogMenu[]): SelectedPositionMatch[] {
  const all = uniqPositions(catalog.flatMap((menu) => menu.positions))
  return suppressGenericCaesarDuplicates(
    all
      .map((position) => matchPositionInText(langbezeichnung, position))
      .filter((match): match is SelectedPositionMatch => Boolean(match))
      .sort((a, b) => b.confidence - a.confidence),
  )
}

function reconstructRowItems(row: ProduktbedarfRow, menuMatch: MenuMatch, catalog: ImportCatalogMenu[]): SelectedPositionMatch[] {
  if (row.istOptional && !menuMatch.menu) {
    return reconstructAddOnItems(row.langbezeichnung || row.produkt, catalog)
  }
  return reconstructSelectedItems(row.langbezeichnung, menuMatch.menu)
}

function fillMissingVariantItems(
  selectedItems: SelectedPositionMatch[],
  expectedItemCount: ExpectedItemCountMatch,
  langbezeichnung: string,
): SelectedPositionMatch[] {
  if (expectedItemCount.itemCount == null || selectedItems.length >= expectedItemCount.itemCount) return selectedItems

  const missing = expectedItemCount.itemCount - selectedItems.length
  return [
    ...selectedItems,
    ...Array.from({ length: missing }, (_, index) => ({
      rawPositionText: `Nicht erkannte Position ${index + 1}`,
      originalText: langbezeichnung,
      matchedMenuItemId: null,
      matchedRecipeId: null,
      matchedPositionName: null,
      confidence: 0,
      needsReview: true,
    })),
  ]
}

function validateOrder(row: ProduktbedarfRow, order: ProduktbedarfAuftrag, menuMatch: MenuMatch, expectedItemCount: ExpectedItemCountMatch, selectedItems: SelectedPositionMatch[], standalone = false): string[] {
  const warnings: string[] = []
  if (!/pax/i.test(row.einheit)) warnings.push(`Einheit ist nicht pax: ${row.einheit || 'leer'}`)
  if (row.mengeFehlt) warnings.push('Keine Anzahl/Packsanzahl/Menge/Quantity/Pax in CSV gefunden')
  if (!menuMatch.menu && !row.istAddOn && !standalone) warnings.push('Menu muss geprueft werden')
  if (selectedItems.some((item) => item.needsReview)) warnings.push('Mindestens eine Position muss geprueft werden')
  if (expectedItemCount.itemCount != null) {
    if (selectedItems.length < expectedItemCount.itemCount) {
      warnings.push(`${expectedItemCount.itemCount} Positionen erwartet, aber nur ${selectedItems.length} erkannt`)
    }
    if (selectedItems.length > expectedItemCount.itemCount) {
      warnings.push(`${expectedItemCount.itemCount} Positionen erwartet, aber ${selectedItems.length} erkannt`)
    }
  }
  if (order.pax <= 0) warnings.push('Event-Pax ist 0 oder ungueltig')
  return warnings
}

export function buildProduktbedarfImportDraft(rows: ProduktbedarfRow[], catalog: ImportCatalogMenu[]): ProduktbedarfImportDraft {
  const eventMap = new Map<string, ImportedEventDraft>()
  const draftWarnings: string[] = []
  let totalOrders = 0

  rows.forEach((row, index) => {
    const auftraege = parseAuftraege(row.auftraege, row.menge, row.einheit)
    const sumPax = auftraege.reduce((sum, order) => sum + order.pax, 0)
    const rowWarnings: string[] = []
    if (/pax/i.test(row.einheit) && row.menge > 0 && Math.abs(sumPax - row.menge) > 0.01) {
      rowWarnings.push(`CSV-Menge ${row.menge} ${row.einheit}, Auftraege ergeben ${sumPax}`)
    }

    const productText = `${row.produkt} ${row.langbezeichnung}`.trim()
    const originalImportText = buildOriginalImportText(row)
    // Add-on-Zeilen (MouseClick "Add On …") gehören zu keinem Menü — sie werden
    // direkt gegen die als Add-on markierten Positionen gematcht.
    const menuMatch: MenuMatch = row.istAddOn || row.keinBedarf
      ? { menu: null, confidence: 0, strategy: 'no-match', needsReview: false, warnings: [] }
      : matchMenu(`${productText}\n${row.auftraege}\n${row.klassifizierung}`, catalog)
    const expectedItemCount = row.istAddOn || row.keinBedarf ? { itemCount: null, confidence: 0 } : detectExpectedItemCount(productText)

    // Einzel-Positions-Zeile: keine "X Teile"-Erwartung und der Langtext trifft
    // genau EINE Katalog-Position → direkt diese Position zuordnen (kein Vollmenü).
    const standaloneMatches = !row.istAddOn && !row.keinBedarf && expectedItemCount.itemCount == null
      ? matchAllPositions(row.langbezeichnung, catalog)
      : []
    const isStandalone = standaloneMatches.length === 1

    const selectedItems = row.keinBedarf
      ? []
      : row.istAddOn
        ? reconstructAddOnItems(row.langbezeichnung || row.produkt, catalog)
        : isStandalone
          ? standaloneMatches
          : fillMissingVariantItems(
              reconstructRowItems(row, menuMatch, catalog),
              expectedItemCount,
              row.langbezeichnung,
            )

    for (const auftrag of auftraege) {
      const normalizedEventName = normalizeText(auftrag.eventName)
      const warnings = row.keinBedarf
        ? []
        : [
            ...rowWarnings,
            ...(isStandalone || row.istAddOn ? [] : menuMatch.warnings),
            ...validateOrder(row, auftrag, menuMatch, expectedItemCount, selectedItems, isStandalone),
          ]
      const status: ImportedOrderDraft['status'] = warnings.length > 0 ? 'needs_review' : 'matched'
      const orderDraft: ImportedOrderDraft = {
        sourceRowNumber: index + 2,
        produkt: row.produkt,
        langbezeichnung: row.langbezeichnung,
        originalImportText,
        menge: row.menge,
        einheit: row.einheit,
        klassifizierung: row.klassifizierung,
        auftraege: row.auftraege,
        eventName: auftrag.eventName,
        eventPax: auftrag.pax,
        rawAuftragText: auftrag.rawText,
        menuMatch,
        expectedItemCount,
        selectedItems: selectedItems.map((item) => ({ ...item })),
        status,
        warnings,
      }

      const existing = eventMap.get(normalizedEventName)
      if (existing) {
        existing.orders.push(orderDraft)
        existing.pax = Math.max(existing.pax, auftrag.pax)
        existing.warnings = uniq([...existing.warnings, ...warnings])
        existing.status = existing.orders.some((o) => o.status === 'needs_review') ? 'needs_review' : 'matched'
      } else {
        eventMap.set(normalizedEventName, {
          eventName: auftrag.eventName,
          normalizedEventName,
          pax: auftrag.pax,
          orders: [orderDraft],
          warnings: uniq(warnings),
          status,
        })
      }
      totalOrders++
    }
  })

  for (const event of eventMap.values()) {
    if (event.orders.length > 1) {
      const paxValues = uniq(event.orders.map((order) => String(order.eventPax)))
      if (paxValues.length > 1) {
        event.warnings = uniq([...event.warnings, `Uneinheitliche Pax-Werte im Event: ${paxValues.join(', ')}`])
        event.status = 'needs_review'
      }
    }
  }

  return {
    events: [...eventMap.values()].sort((a, b) => a.eventName.localeCompare(b.eventName, 'de')),
    totalRows: rows.length,
    totalOrders,
    warnings: draftWarnings,
  }
}
