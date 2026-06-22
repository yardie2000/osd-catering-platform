import { supabase } from '@/lib/supabase/client'
import type { SupplierProduct } from '@/types'
import type { CalcMenu } from '@/lib/purchasing/aggregate'
import { buildCalcMenus, type RawCalcMenu } from '@/lib/operations/calcMenu'

// Shared read layer for the calculation/output flow. Menu+pax entry lives in
// kitchen batches (services/batch.service.ts); this only fetches the data the
// aggregation needs.
export const purchasingService = {
  // Deep embed: menus → menu_positions → position → position_components →
  // recipe → recipe_ingredients → ingredient/unit. One query for all requested menus.
  async getMenusForCalc(menuIds: string[]): Promise<CalcMenu[]> {
    if (menuIds.length === 0) return []
    const { data, error } = await supabase
      .from('menus')
      .select(`
        id,
        menu_code,
        menu_name,
        menu_positions(
          id,
          sort_order,
          position:positions(
            id,
            name,
            components:position_components(
              id,
              recipe_id,
              ingredient_id,
              quantity,
              unit_id,
              recipe:recipes(
                id,
                recipe_code,
                name,
                base_portions,
                yield_quantity,
                production_notes,
                production_loss_pct,
                yield_pct,
                recipe_ingredients(
                  id,
                  quantity,
                  ingredient_id,
                  unit_id,
                  ingredient:ingredients(id, ingredient_code, name, category),
                  unit:units!recipe_ingredients_unit_id_fkey(id, unit_code, name, short_name)
                )
              ),
              ingredient:ingredients(id, ingredient_code, name, category),
              unit:units!position_components_unit_id_fkey(id, unit_code, name, short_name)
            )
          )
        )
      `)
      .in('id', menuIds)
    if (error) throw error
    return buildCalcMenus((data ?? []) as unknown as RawCalcMenu[])
  },

  // supplier_products for the given ingredients — used for cost estimate + comparison.
  async getSupplierProducts(ingredientIds: string[]): Promise<SupplierProduct[]> {
    if (ingredientIds.length === 0) return []
    const { data, error } = await supabase
      .from('supplier_products')
      .select('*')
      .in('ingredient_id', ingredientIds)
    if (error) throw error
    return data ?? []
  },
}
