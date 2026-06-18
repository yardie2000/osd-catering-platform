import type { CalcMenu, CalcMenuItem, CalcMenuItemComponent } from '@/lib/purchasing/aggregate'

// Raw shape returned by purchasingService.getMenusForCalc (Supabase deep embed):
// a menu carries BOTH the new menu_positions → positions → position_components
// path AND the legacy menu_items (+ menu_item_components) path.
export type RawCalcMenuPosition = {
  id:         string
  sort_order: number | null
  position:   { id: string; name: string; components: CalcMenuItemComponent[] } | null
}

export type RawCalcMenu = {
  id:              string
  menu_code:       string
  menu_name:       string
  menu_items:      CalcMenuItem[]
  menu_positions?: RawCalcMenuPosition[] | null
}

/**
 * Normalise raw menus into CalcMenu for the engine. Prefers the shared positions
 * catalog (menu_positions → position → position_components) when a menu has
 * positions; otherwise falls back to the legacy menu_items path. Either way the
 * engine sees menu_items[].components and explodes them identically.
 */
export function buildCalcMenus(raw: RawCalcMenu[]): CalcMenu[] {
  return raw.map((m) => {
    const positions = m.menu_positions ?? []
    if (positions.length > 0) {
      const menu_items: CalcMenuItem[] = [...positions]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((mp) => ({
          id:         mp.id,
          name:       mp.position?.name ?? '',
          recipe_id:  null,
          recipe:     null,
          components: mp.position?.components ?? [],
        }))
      return { id: m.id, menu_code: m.menu_code, menu_name: m.menu_name, menu_items }
    }
    // Legacy fallback: menu still modelled via menu_items.
    return { id: m.id, menu_code: m.menu_code, menu_name: m.menu_name, menu_items: m.menu_items }
  })
}
