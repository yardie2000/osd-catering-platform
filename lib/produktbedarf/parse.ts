// Parser for the MouseClick "Produktbedarf" (product demand) export.
//
// The export is a semicolon-delimited, double-quote-quoted CSV with a
// multi-line `Aufträge` field (embedded newlines inside the quotes), so it
// must be tokenized with a real CSV reader — splitting on "\n" would break
// every row that lists more than one Auftrag.
//
// Columns (header row): Produkt ; Langbezeichnung ; Menge ; Einheit ; Aufträge ; Klassifizierung

export type ProduktbedarfRow = {
  /** Short product name as shown in MouseClick. May be truncated ("…"). */
  produkt: string
  /** Full descriptive name incl. components — useful to disambiguate matches. */
  langbezeichnung: string
  /** Total demand quantity across all events (0 when MouseClick reports none). */
  menge: number
  /** CSV column used for menge according to the import fallback rule. */
  mengenQuelle: 'anzahl' | 'packsanzahl' | 'menge' | 'quantity' | 'pax' | null
  /** True when no import quantity column had a usable positive value. */
  mengeFehlt: boolean
  /** Unit of `menge`: usually "pax", sometimes "Stück"/"Stk", occasionally empty. */
  einheit: string
  /** Raw Aufträge text, newlines normalised to "; ". */
  auftraege: string
  /** Number of contributing events parsed from the Aufträge field. */
  auftragCount: number
  /** MouseClick classification, e.g. "Speisen" or "Optional zubuchbar". */
  klassifizierung: string
  /** True when the product is an optional/add-on line ("Optional zubuchbar"). */
  istOptional: boolean
  /** True when the product is a MouseClick add-on row (Produkt/Langbezeichnung beginnt mit "Add On"). */
  istAddOn: boolean
  /** True für Zeilen ohne eigenen Produktionsbedarf (Service/Gebühr/extern: Tellergeld, Auslöse, "made by ZANE" …). */
  keinBedarf: boolean
}

/** Erkennt MouseClick-Add-on-Zeilen am Namen ("Add On ..."). */
export function detectAddOn(produkt: string, langbezeichnung: string): boolean {
  return /^\s*add\s*[- ]?on\b/i.test(produkt) || /^\s*add\s*[- ]?on\b/i.test(langbezeichnung)
}

/**
 * Erkennt Zeilen ohne eigenen Küchen-Produktionsbedarf: Service-/Gebühr-/
 * Equipment-Posten (Tellergeld, Cateringauslöse, Servietten, Mietgeschirr,
 * Pfand) und extern zugekaufte Posten ("made by ZANE", z. B. Hochzeitstorte,
 * Cake-Pops). Diese sollen nicht im Review als Produktionspositionen erscheinen.
 */
export function detectNoDemand(produkt: string, langbezeichnung: string): boolean {
  const t = `${produkt} ${langbezeichnung}`
  return /tellergeld|catering\s*ausl|\bausl[oö]se\b|made by zane|servietten?|mietgeschirr|\bgeschirr\b|\bbesteck\b|\bpfand\b|nutzung von (kleinen )?tellern/i.test(t)
}

const HTML_ENTITIES: Record<string, string> = {
  '&lsquo;': '‘',
  '&rsquo;': '’',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&nbsp;': ' ',
}

function decodeEntities(value: string): string {
  return value.replace(/&[a-z]+;/gi, (m) => HTML_ENTITIES[m] ?? m)
}

function clean(value: string): string {
  return decodeEntities(value).replace(/\s+/g, ' ').trim()
}

/**
 * Tokenise a delimited, double-quoted text into a grid of cells.
 * Handles quoted fields containing the delimiter, embedded newlines and
 * doubled "" escapes. Recognises both \n and \r\n line breaks.
 */
export function tokenizeDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Strip a UTF-8 BOM if present.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch === '\r') {
      // Swallow; the following \n (if any) closes the row.
    } else {
      field += ch
    }
  }

  // Flush trailing field/row if the file does not end with a newline.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function detectDelimiter(headerLine: string): string {
  const semis = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return commas > semis ? ',' : ';'
}

function toNumberOrNull(value: string): number | null {
  // MouseClick reports plain integers; tolerate thousands dots / decimal commas.
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function headerIndex(header: string[], ...names: string[]): number {
  const normalized = header.map((h) => clean(h).toLowerCase())
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

/**
 * Parse a raw Produktbedarf CSV export into structured rows.
 * Rows without a product name are skipped (e.g. trailing blank lines).
 */
export function parseProduktbedarfCsv(text: string): ProduktbedarfRow[] {
  const firstBreak = text.indexOf('\n')
  const headerLine = firstBreak === -1 ? text : text.slice(0, firstBreak)
  const delimiter = detectDelimiter(headerLine)

  const grid = tokenizeDelimited(text, delimiter)
  if (grid.length === 0) return []

  const header = grid[0]
  const iProdukt = headerIndex(header, 'Produkt')
  const iLang = headerIndex(header, 'Langbezeichnung', 'Bezeichnung')
  const iAnzahl = headerIndex(header, 'Anzahl')
  const iPacksanzahl = headerIndex(header, 'Packsanzahl', 'Packanzahl', 'Packs', 'Pack Quantity')
  const iMenge = headerIndex(header, 'Menge')
  const iQuantity = headerIndex(header, 'Quantity', 'Qty')
  const iPax = headerIndex(header, 'Pax', 'Personen')
  const iEinheit = headerIndex(header, 'Einheit')
  const iAuftraege = headerIndex(header, 'Aufträge', 'Auftraege')
  const iKlass = headerIndex(header, 'Klassifizierung', 'Klasse')

  const rows: ProduktbedarfRow[] = []

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]
    const produkt = iProdukt >= 0 ? clean(cells[iProdukt] ?? '') : ''
    if (!produkt) continue

    const auftraegeRaw = iAuftraege >= 0 ? cells[iAuftraege] ?? '' : ''
    const auftragCount = (auftraegeRaw.match(/\([^)]*\)\s*$/gm) ?? []).length
    const klassifizierung = iKlass >= 0 ? clean(cells[iKlass] ?? '') : ''

    const quantityCandidates = [
      { source: 'anzahl' as const, index: iAnzahl },
      { source: 'packsanzahl' as const, index: iPacksanzahl },
      { source: 'menge' as const, index: iMenge },
      { source: 'quantity' as const, index: iQuantity },
      { source: 'pax' as const, index: iPax },
    ]
    const quantity = quantityCandidates
      .map((candidate) => ({
        source: candidate.source,
        value: candidate.index >= 0 ? toNumberOrNull(cells[candidate.index] ?? '') : null,
      }))
      .find((candidate) => candidate.value != null && candidate.value > 0) ?? null

    const langbezeichnung = iLang >= 0 ? clean(cells[iLang] ?? '') : ''
    rows.push({
      produkt,
      langbezeichnung,
      menge: quantity?.value ?? 0,
      mengenQuelle: quantity?.source ?? null,
      mengeFehlt: !quantity,
      einheit: iEinheit >= 0 ? clean(cells[iEinheit] ?? '') : '',
      auftraege: clean(auftraegeRaw),
      auftragCount,
      klassifizierung,
      istOptional: /optional/i.test(klassifizierung),
      istAddOn: detectAddOn(produkt, langbezeichnung),
      keinBedarf: detectNoDemand(produkt, langbezeichnung),
    })
  }

  return rows
}
