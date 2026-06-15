// Lightweight name matcher: suggests which catalog Menu a MouseClick product
// most likely corresponds to. Deliberately simple (normalise + token overlap) —
// the user always confirms/overrides in the UI, so this only needs to surface a
// sensible default, not be authoritative.

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOP = new Set(['und', 'oder', 'mit', 'auch', 'der', 'die', 'das', 'pax', 'ca', 'teile', 'tbd'])

function tokens(value: string): string[] {
  return normalizeName(value)
    .split(' ')
    .filter((t) => t.length > 2 && !STOP.has(t))
}

/**
 * Score how well a product (its short + long name) matches a menu candidate.
 * Returns 0..1 = share of the menu's tokens that also occur in the product text.
 */
export function scoreMatch(productText: string, menuText: string): number {
  const menuTokens = tokens(menuText)
  if (menuTokens.length === 0) return 0
  const productTokens = new Set(tokens(productText))
  if (productTokens.size === 0) return 0
  let hits = 0
  for (const t of menuTokens) if (productTokens.has(t)) hits++
  return hits / menuTokens.length
}

export type MenuCandidate = { id: string; text: string }

/**
 * Pick the best-scoring menu for a product. Returns null when nothing clears
 * the threshold, so the UI leaves the row unmatched rather than guessing.
 */
export function suggestMatch(
  productText: string,
  candidates: MenuCandidate[],
  threshold = 0.5,
): { id: string; score: number } | null {
  let best: { id: string; score: number } | null = null
  for (const c of candidates) {
    const score = scoreMatch(productText, c.text)
    if (!best || score > best.score) best = { id: c.id, score }
  }
  return best && best.score >= threshold ? best : null
}
