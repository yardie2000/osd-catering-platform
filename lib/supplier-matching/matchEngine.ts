// Matching-Engine: Lieferantenartikel → Zutat (Teil 8).
//
// Ordnet einen realen Lieferantenartikel (Metro / Chefs Culinar) der fachlichen,
// lieferantenneutralen Zutat zu. Bewusst einfach und deterministisch (Normalisierung
// + Token-Overlap) — die Engine schlägt vor, der Mensch bestätigt im Assistenten.
//
// Regeln (entsprechen Teil 8):
//   • genau ein klarer Treffer  → verknüpfen (kein Review)
//   • mehrere plausible Treffer → besten verknüpfen, aber als Review markieren
//   • kein Treffer              → neue Zutat anlegen
//   • ein Artikel gehört immer genau EINER Zutat (genau ein Mapping je Artikel)

import { normalizeName } from '@/lib/produktbedarf/match'

const STOP = new Set([
  'und', 'oder', 'mit', 'der', 'die', 'das', 'im', 'in', 'aus', 'fuer', 'von',
  'tk', 'kg', 'gr', 'ml', 'stk', 'stueck', 'pck', 'pkg', 'dose', 'glas', 'beutel',
  'frisch', 'frische', 'frozen', 'gefroren', 'natur', 'ca', 'je', 'per', 'lose',
])

export function tokenize(value: string): string[] {
  return normalizeName(value)
    .split(' ')
    // Mengen-/Gebinde-Rauschen verwerfen: Tokens mit Ziffer (z. B. "125", "4x980",
    // "25cmx12stk") tragen keine fachliche Bedeutung und erzeugen sonst falsche
    // Treffer über geteilte Mengenangaben in Lieferantennamen.
    .filter((t) => t.length > 2 && !STOP.has(t) && !/\d/.test(t))
}

/** Anzeigename eines Artikels für Matching/Logs. */
export function articleName(a: {
  clean_article_name_de?: string | null
  ingredient_name_de?: string | null
  raw_article_name?: string | null
}): string {
  return (a.clean_article_name_de ?? a.ingredient_name_de ?? a.raw_article_name ?? '').trim()
}

/**
 * Erzeugt einen brauchbaren Zutatennamen aus einem rohen Lieferanten-Artikelnamen,
 * wenn eine Zutat neu angelegt werden muss. Entfernt führende Mengen/Gebinde
 * ("125 g", "4 kg", "1,75 kg", "2650 ml") und einen abschließenden Länder-/Kurzcode
 * (z. B. "ES", "DE", "NL") und setzt das Ergebnis in Title-Case.
 * "125 g BROMBEEREN ES" → "Brombeeren".
 */
export function cleanIngredientName(raw: string): string {
  let s = (raw ?? '').trim()
  // wiederholte führende Menge + Einheit
  s = s.replace(/^\s*\d+([.,]\d+)?\s*(x\s*\d+\s*)?(stk|stueck|stück|kg|gr|g|ml|l|cm|dose|glas|pck|beutel)\b\.?\s*/gi, '')
  // verbleibende führende reine Zahl
  s = s.replace(/^\s*\d+([.,]\d+)?\s*/, '')
  // abschließender 2–3-stelliger Großbuchstaben-Code (Länderkürzel)
  s = s.replace(/\s+[A-Z]{2,3}\s*$/, '')
  s = s.replace(/\s+/g, ' ').trim()
  if (!s) return (raw ?? '').trim()
  return s
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
}

/**
 * Ähnlichkeit Zutatenname ↔ Artikelname (0..1). Gerichtet: Anteil der
 * (kurzen, kanonischen) Zutaten-Tokens, die im (langen, rohen) Artikelnamen
 * vorkommen. Voller Substring-Treffer des normalisierten Zutatennamens zählt hoch.
 */
export function scoreNames(ingredientName: string, supplierArticleName: string): number {
  const iNorm = normalizeName(ingredientName)
  const aNorm = normalizeName(supplierArticleName)
  if (!iNorm || !aNorm) return 0
  if (iNorm === aNorm) return 1

  const iTokens = tokenize(ingredientName)
  if (iTokens.length === 0) return 0
  const aTokens = new Set(tokenize(supplierArticleName))
  let hits = 0
  for (const t of iTokens) if (aTokens.has(t)) hits++
  let score = hits / iTokens.length

  // Voller Name als Wortgrenze im Artikel (z. B. "Burrata" in "Burrata Pugliese 125g").
  if (iNorm.length >= 3 && new RegExp(`(^|\\s)${iNorm}(\\s|$)`).test(aNorm)) {
    score = Math.max(score, 0.9)
  }
  return score
}

export type MatchableIngredient = { id: string; name: string }

export type ArticleDecision = {
  decision: 'link' | 'review' | 'create'
  matchType: 'exakt' | 'starker_name' | 'mehrdeutig' | 'manuell'
  /** 0..100 */
  score: number
  ingredientId: string | null
  reason?: string
  contenders: { id: string; name: string; score: number }[]
}

const STRONG = 0.72   // klarer Einzeltreffer
const AMBIG_MIN = 0.5 // ab hier „plausibel" → mind. Review
const MARGIN = 0.12   // Vorsprung des Besten, damit es kein Review ist

/**
 * Klassifiziert einen Artikel gegen den Zutaten-Katalog. Pure Funktion (kein I/O).
 */
export function classifyArticle(
  supplierArticleName: string,
  ingredients: MatchableIngredient[],
): ArticleDecision {
  const name = supplierArticleName.trim()
  if (!name) {
    return { decision: 'create', matchType: 'manuell', score: 0, ingredientId: null, contenders: [] }
  }

  const aNorm = normalizeName(name)

  // 1) Exakte Namensgleichheit
  const exacts = ingredients.filter((i) => normalizeName(i.name) === aNorm)
  if (exacts.length === 1) {
    return { decision: 'link', matchType: 'exakt', score: 100, ingredientId: exacts[0].id, contenders: [{ id: exacts[0].id, name: exacts[0].name, score: 1 }] }
  }
  if (exacts.length > 1) {
    return {
      decision: 'review', matchType: 'mehrdeutig', score: 100, ingredientId: exacts[0].id,
      reason: `Mehrere Zutaten mit identischem Namen: ${exacts.map((e) => e.name).join(', ')}`,
      contenders: exacts.map((e) => ({ id: e.id, name: e.name, score: 1 })),
    }
  }

  // 2) Fuzzy-Score über alle Zutaten
  const scored = ingredients
    .map((i) => ({ id: i.id, name: i.name, score: scoreNames(i.name, name) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  const second = scored[1]
  const contenders = scored.filter((s) => s.score >= AMBIG_MIN).slice(0, 5)

  if (!best || best.score < AMBIG_MIN) {
    return { decision: 'create', matchType: 'manuell', score: 0, ingredientId: null, contenders: [] }
  }

  const clearWinner = best.score >= STRONG && (!second || best.score - second.score >= MARGIN)
  if (clearWinner) {
    return { decision: 'link', matchType: 'starker_name', score: Math.round(best.score * 100), ingredientId: best.id, contenders }
  }

  return {
    decision: 'review', matchType: 'mehrdeutig', score: Math.round(best.score * 100), ingredientId: best.id,
    reason: `Mehrdeutig: ${contenders.map((c) => `${c.name} (${Math.round(c.score * 100)})`).join(', ')}`,
    contenders,
  }
}
