// Übernahme geprüfter Bedarf-Import-Bestellungen in Produktionslauf-Items.
//
// Eine Bestellung (imported_event_order) = ein verkauftes Menü mit Pax und den
// im Review tatsächlich GEWÄHLTEN Positionen. Daraus werden kitchen_batch_items
// (Menü + Pax + optionale Positionsauswahl). Gleiche (Menü + identische Auswahl)
// werden über alle Events des Laufs zusammengefasst und die Pax summiert.

export type PromoteOrderInput = {
  matchedMenuId: string | null
  eventPax: number
  noDemand: boolean
  // matched_menu_item_id der gewählten Items (nur die zugeordneten, non-null)
  selectedPositionIds: string[]
  // ALLE Positions-IDs des zugeordneten Menüs (aus dem Katalog)
  menuPositionIds: string[]
}

export type PromotedBatchItem = {
  menuId: string
  paxCount: number
  // leer = ganzes Menü; sonst genau diese Positionen produzieren
  positionIds: string[]
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort()
}

/**
 * Bestimmt, ob eine Bestellung das ganze Menü oder nur eine Auswahl ist.
 * Ganzes Menü, wenn KEINE Position gewählt wurde ODER die Auswahl ALLE
 * Menüpositionen abdeckt. Sonst Auswahl (genau die gewählten Positionen).
 *
 * Bewusst NICHT an expected_item_count gekoppelt: Einzel-Positions-Zeilen
 * ("Fingerfood Caesar") haben kein erwartetes Teile-Count, sind aber trotzdem
 * eine Auswahl von genau einer Position — nicht das ganze Menü.
 */
export function resolvePositionSelection(order: PromoteOrderInput): string[] {
  const menuSet = new Set(order.menuPositionIds)
  const valid = uniqueSorted(order.selectedPositionIds.filter((id) => menuSet.has(id)))
  if (valid.length === 0) return [] // ganzes Menü (nichts Spezifisches gewählt)
  const coversAll =
    order.menuPositionIds.length > 0 && order.menuPositionIds.every((id) => valid.includes(id))
  return coversAll ? [] : valid
}

/**
 * Fasst geprüfte Bestellungen zu Produktionslauf-Items zusammen.
 * Übersprungen: kein Produktionsbedarf, kein zugeordnetes Menü, Pax <= 0.
 * Gruppierung: (Menü, identische Positionsauswahl) → Pax summiert.
 */
export function aggregatePromotedItems(orders: PromoteOrderInput[]): PromotedBatchItem[] {
  const groups = new Map<string, PromotedBatchItem>()
  for (const order of orders) {
    if (order.noDemand) continue
    if (!order.matchedMenuId) continue
    const pax = Number(order.eventPax) || 0
    if (pax <= 0) continue

    const positionIds = resolvePositionSelection(order)
    const key = `${order.matchedMenuId}::${positionIds.length === 0 ? '*' : positionIds.join(',')}`
    const existing = groups.get(key)
    if (existing) {
      existing.paxCount += pax
    } else {
      groups.set(key, { menuId: order.matchedMenuId, paxCount: pax, positionIds })
    }
  }
  return [...groups.values()]
}

/**
 * Leitet aus dem Importdateinamen Lauf-Name + Datumsbereich ab.
 * Erkennt Muster "…YYYY-MM-DDbisDD…" (MouseClick-Export, z. B.
 * "Produktbedarf_2026-07-01bis30.csv") und expandiert das End-Datum.
 */
export function deriveBatchMeta(filename: string | null): {
  name: string
  startDate: string | null
  endDate: string | null
} {
  const base = (filename ?? '').replace(/\.csv$/i, '').trim()
  const name = base ? `Import ${base}` : 'Import Produktbedarf'
  const range = base.match(/(\d{4})-(\d{2})-(\d{2})\s*bis\s*(\d{2})(?:[.-](\d{2}))?/i)
  if (range) {
    const [, year, month, day1, day2OrMonth2, maybeDay2] = range
    const startDate = `${year}-${month}-${day1}`
    // "bis30" → selber Monat; "bis08-15" → Monat 08, Tag 15
    const endDate = maybeDay2
      ? `${year}-${day2OrMonth2}-${maybeDay2}`
      : `${year}-${month}-${day2OrMonth2}`
    return { name, startDate, endDate }
  }
  return { name, startDate: null, endDate: null }
}
