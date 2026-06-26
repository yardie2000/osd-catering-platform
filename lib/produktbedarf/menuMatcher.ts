// Multi-stage matcher: MouseClick Produktbedarf CSV → Menu → Position → Recipe
//
// Architecture:
//   CSV "Fingerfood Caesar"
//     Stage 1: exact match against menu_name               → no hit
//     Stage 2: high-confidence fuzzy match against menus   → no hit
//     Stage 3: split produkt into (menu-prefix, position)  → hit
//     Stage 4: position-only search across all menus       → fallback
//     Stage 5: needs-review                                → ambiguous / low confidence
//
// Purely functional — no DB calls. Receives pre-loaded MatchableMenu[] from
// use-matcher-context.ts. All matching is done in-memory.

// ── Public types ─────────────────────────────────────────────────────────────

export type MatchStrategy =
  | 'exact-menu'          // produkt normalised === menu_name normalised
  | 'fuzzy-menu'          // token-overlap >= 0.85 against menu_name
  | 'menu-position-split' // prefix → menu, suffix → position within that menu
  | 'position-only'       // produkt matched a position name regardless of menu
  | 'needs-review'        // ambiguous / multiple candidates with similar score
  | 'no-match'            // nothing found

export type MatchResult = {
  confidence: number            // 0..1
  matchedMenuId: string | null
  matchedMenuName: string | null
  matchedPositionId: string | null
  matchedPositionName: string | null
  matchedRecipeIds: string[]
  strategy: MatchStrategy
  warnings: string[]
  needsReview: boolean
  log: string[]
}

export type MatchablePosition = {
  id: string
  name: string
  position_code: string | null
  recipeIds: string[]
}

export type MatchableMenu = {
  id: string
  menu_name: string
  menu_code: string
  positions: MatchablePosition[]
}

// ── String normalisation ──────────────────────────────────────────────────────

export function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    // remove apostrophes / curly quotes so "Caesar's" → "caesars"
    .replace(/[''´`']/g, '')
    // collapse all remaining punctuation / special chars to a single space
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Stop-words that carry no discriminative value in menu/position names
const STOP = new Set([
  'und', 'oder', 'mit', 'auch', 'der', 'die', 'das', 'den', 'dem',
  'pax', 'ca', 'teile', 'tbd', 'abends', 'tagsüber', 'ganztaegig',
  'ganztägig', 'mit', 'ohne', 'fuer', 'von', 'als', 'zum', 'zur',
])

function tokenize(s: string): string[] {
  return normalizeStr(s)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP.has(t))
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

/**
 * Token-overlap score: fraction of candidateText's tokens found in queryText.
 * 0 = no overlap, 1 = all candidate tokens present in query.
 */
function tokenOverlap(queryText: string, candidateText: string): number {
  const candidateToks = tokenize(candidateText)
  if (candidateToks.length === 0) return 0
  const queryToks = new Set(tokenize(queryText))
  if (queryToks.size === 0) return 0
  let hits = 0
  for (const t of candidateToks) if (queryToks.has(t)) hits++
  return hits / candidateToks.length
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const prev = Array.from({ length: n + 1 }, (_, j) => j)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1])
    }
    prev.splice(0, n + 1, ...curr)
  }
  return prev[n]
}

/**
 * Character-level similarity (0..1) after normalisation.
 * Used for short strings where token-overlap breaks down.
 */
function charSimilarity(a: string, b: string): number {
  const na = normalizeStr(a)
  const nb = normalizeStr(b)
  if (na === nb) return 1.0
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1.0
  return 1 - levenshtein(na, nb) / maxLen
}

/**
 * Combined score: max(token-overlap, char-similarity * 0.9).
 * char-similarity is downweighted so token-overlap wins when tokens match.
 */
function score(query: string, candidate: string): number {
  return Math.max(tokenOverlap(query, candidate), charSimilarity(query, candidate) * 0.9)
}

// ── Core matcher ─────────────────────────────────────────────────────────────

const NO_MATCH: MatchResult = {
  confidence: 0,
  matchedMenuId: null,
  matchedMenuName: null,
  matchedPositionId: null,
  matchedPositionName: null,
  matchedRecipeIds: [],
  strategy: 'no-match',
  warnings: ['Kein passendes Menü oder keine passende Position gefunden'],
  needsReview: true,
  log: [],
}

/**
 * Match a single MouseClick Produktbedarf row against the in-memory catalog.
 *
 * @param produkt          Short product name from CSV (truncated, may end "…")
 * @param langbezeichnung  Full description from CSV (used as secondary signal)
 * @param context          Pre-loaded menu catalog with positions + recipe IDs
 */
export function matchProdukt(
  produkt: string,
  langbezeichnung: string,
  context: MatchableMenu[],
): MatchResult {
  const log: string[] = [`CSV: "${produkt}"${langbezeichnung ? ` / "${langbezeichnung.slice(0, 60)}…"` : ''}`]

  if (!produkt.trim() || context.length === 0) {
    return { ...NO_MATCH, log }
  }

  const produktText = `${produkt} ${langbezeichnung}`.trim()

  // ── Stage 1: Exact match ────────────────────────────────────────────────────
  for (const menu of context) {
    if (normalizeStr(produkt) === normalizeStr(menu.menu_name)) {
      log.push(`✓ Exakt-Treffer Menü: "${menu.menu_name}"`)
      log.push(`Confidence: 100 % | Strategy: exact-menu`)
      return {
        confidence: 1.0,
        matchedMenuId: menu.id,
        matchedMenuName: menu.menu_name,
        matchedPositionId: null,
        matchedPositionName: null,
        matchedRecipeIds: [],
        strategy: 'exact-menu',
        warnings: [],
        needsReview: false,
        log,
      }
    }
  }

  // ── Stage 2: High-confidence fuzzy menu match ≥ 0.85 ────────────────────────
  {
    let best: { menu: MatchableMenu; s: number } | null = null
    for (const menu of context) {
      const s = score(produkt, menu.menu_name)
      if (!best || s > best.s) best = { menu, s }
    }
    if (best && best.s >= 0.85) {
      log.push(`✓ Fuzzy-Menü-Treffer: "${best.menu.menu_name}" (${pct(best.s)} %)`)
      log.push(`Confidence: ${pct(best.s)} % | Strategy: fuzzy-menu`)
      return {
        confidence: best.s,
        matchedMenuId: best.menu.id,
        matchedMenuName: best.menu.menu_name,
        matchedPositionId: null,
        matchedPositionName: null,
        matchedRecipeIds: [],
        strategy: 'fuzzy-menu',
        warnings: [],
        needsReview: false,
        log,
      }
    }
  }

  // ── Stage 3: Menu + Position split ──────────────────────────────────────────
  // Try every possible prefix of the produkt token sequence as the menu name,
  // the remaining suffix as the position name.
  {
    const parts = produkt.trim().split(/\s+/)
    type SplitCandidate = {
      menu: MatchableMenu
      menuScore: number
      position: MatchablePosition | null
      positionScore: number
      combined: number
    }
    const candidates: SplitCandidate[] = []

    for (let k = 1; k < parts.length; k++) {
      const prefix = parts.slice(0, k).join(' ')
      const suffix = parts.slice(k).join(' ')
      if (!suffix.trim()) continue

      // Try ALL menus for this prefix — not just the top-scoring one —
      // so that a position match can tip the balance toward the right menu
      // (e.g. "Fingerfood Fish and Chips": both FF menus score equally on
      // "Fingerfood", but only FF-3 has the "Fish and Chips" position).
      for (const menu of context) {
        const menuScore = score(prefix, menu.menu_name)
        if (menuScore < 0.45) continue

        // Best position within this menu for the suffix
        let bestPos: { position: MatchablePosition; s: number } | null = null
        for (const pos of menu.positions) {
          const s = Math.max(
            score(suffix, pos.name),
            tokenOverlap(produktText, pos.name),
          )
          if (!bestPos || s > bestPos.s) bestPos = { position: pos, s }
        }

        const menuWeight = 0.65
        const posWeight = 0.35
        const combined = menuScore * menuWeight + (bestPos?.s ?? 0) * posWeight

        candidates.push({
          menu,
          menuScore,
          position: bestPos?.position ?? null,
          positionScore: bestPos?.s ?? 0,
          combined,
        })
      }
    }

    if (candidates.length > 0) {
      candidates.sort((a, b) => b.combined - a.combined)
      const best = candidates[0]
      // Ambiguous: multiple candidates within 0.1 of the best combined score
      const topGroup = candidates.filter((c) => c.combined >= best.combined - 0.1)
      const ambiguous = topGroup.length > 1 && best.combined < 0.9

      log.push(`✓ Menü erkannt: "${best.menu.menu_name}" (${pct(best.menuScore)} %)`)
      if (best.position) {
        log.push(`✓ Position erkannt: "${best.position.name}" (${pct(best.positionScore)} %)`)
        if (best.position.recipeIds.length > 0) {
          log.push(`✓ Rezept verknüpft (${best.position.recipeIds.length})`)
        }
      } else {
        log.push(`⚠ Kein Positionstreffer im Menü "${best.menu.menu_name}"`)
      }
      log.push(`Confidence: ${pct(best.combined)} % | Strategy: ${ambiguous ? 'needs-review' : 'menu-position-split'}`)

      const warnings: string[] = []
      if (ambiguous)
        warnings.push(
          `Mehrere ähnliche Treffer (${topGroup.map((c) => `"${c.menu.menu_name}"`).join(', ')})`,
        )
      if (!best.position)
        warnings.push(`Menü "${best.menu.menu_name}" erkannt, aber keine passende Position`)

      return {
        confidence: best.combined,
        matchedMenuId: best.menu.id,
        matchedMenuName: best.menu.menu_name,
        matchedPositionId: best.position?.id ?? null,
        matchedPositionName: best.position?.name ?? null,
        matchedRecipeIds: best.position?.recipeIds ?? [],
        strategy: ambiguous ? 'needs-review' : 'menu-position-split',
        warnings,
        needsReview: ambiguous || best.combined < 0.5,
        log,
      }
    }
  }

  // ── Stage 4: Position-only search ───────────────────────────────────────────
  {
    type PosCand = { menu: MatchableMenu; pos: MatchablePosition; s: number }
    const found: PosCand[] = []

    for (const menu of context) {
      for (const pos of menu.positions) {
        const s = Math.max(
          score(produkt, pos.name),
          tokenOverlap(produktText, pos.name),
        )
        if (s >= 0.4) found.push({ menu, pos, s })
      }
    }

    if (found.length > 0) {
      found.sort((a, b) => b.s - a.s)
      const best = found[0]
      const topGroup = found.filter((c) => c.s >= best.s - 0.1)
      const ambiguous = topGroup.length > 1

      log.push(`✓ Positions-Treffer: "${best.pos.name}" in Menü "${best.menu.menu_name}" (${pct(best.s)} %)`)
      log.push(`Confidence: ${pct(best.s * 0.75)} % | Strategy: ${ambiguous ? 'needs-review' : 'position-only'}`)

      return {
        confidence: best.s * 0.75, // discount: position-only is less certain
        matchedMenuId: best.menu.id,
        matchedMenuName: best.menu.menu_name,
        matchedPositionId: best.pos.id,
        matchedPositionName: best.pos.name,
        matchedRecipeIds: best.pos.recipeIds,
        strategy: ambiguous ? 'needs-review' : 'position-only',
        warnings: ambiguous
          ? [`Mehrere passende Positionen: ${topGroup.map((c) => `"${c.pos.name}"`).join(', ')}`]
          : [],
        needsReview: ambiguous || best.s < 0.6,
        log,
      }
    }
  }

  // ── Stage 5: No match ───────────────────────────────────────────────────────
  log.push('✗ Kein Treffer — Needs Review')
  return { ...NO_MATCH, log }
}

// ── Batch helper ─────────────────────────────────────────────────────────────

export type BatchMatchResult = {
  produkt: string
  menge: number
  result: MatchResult
}

/**
 * Match all rows from a parsed Produktbedarf export.
 * Returns one BatchMatchResult per row — never drops a row.
 */
export function matchAll(
  rows: { produkt: string; langbezeichnung: string; menge: number }[],
  context: MatchableMenu[],
): BatchMatchResult[] {
  return rows.map((row) => ({
    produkt: row.produkt,
    menge: row.menge,
    result: matchProdukt(row.produkt, row.langbezeichnung, context),
  }))
}

// ── Utils ────────────────────────────────────────────────────────────────────

function pct(n: number): string {
  return Math.round(n * 100).toString()
}
