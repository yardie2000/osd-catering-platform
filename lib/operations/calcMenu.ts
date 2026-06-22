import type { CalcMenu, CalcMenuItem, CalcMenuItemComponent } from '@/lib/purchasing/aggregate'

// Raw shape returned by purchasingService.getMenusForCalc (Supabase deep embed):
// a menu is composed of menu_positions → position → position_components.
export type RawCalcMenuPosition = {
  id:         string
  sort_order: number | null
  position:   { id: string; name: string; components: CalcMenuItemComponent[] } | null
}

export type RawCalcMenu = {
  id:              string
  menu_code:       string
  menu_name:       string
  menu_positions?: RawCalcMenuPosition[] | null
}

/**
 * Normalise raw menus into CalcMenu for the engine. Each menu_position becomes a
 * CalcMenuItem carrying the shared position's components; the engine explodes
 * those identically. (Since the V5 cutover the positions catalog is the only
 * source — legacy menu_items/menu_item_components no longer exist.)
 */
export function buildCalcMenus(raw: RawCalcMenu[]): CalcMenu[] {
  return raw.map((m) => {
    const menu_items: CalcMenuItem[] = [...(m.menu_positions ?? [])]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((mp) => ({
        id:         mp.id,
        name:       mp.position?.name ?? '',
        recipe_id:  null,
        recipe:     null,
        components: mp.position?.components ?? [],
      }))
    return { id: m.id, menu_code: m.menu_code, menu_name: m.menu_name, menu_items }
  })
}
