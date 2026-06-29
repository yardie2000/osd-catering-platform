import { supabase } from '@/lib/supabase/client'
import type {
  KitchenBatch,
  KitchenBatchInsert,
  KitchenBatchUpdate,
  KitchenBatchWithItems,
} from '@/types'
import { purchasingService } from '@/services/purchasing.service'
import { computeBatchOutputs, type BatchOutputs } from '@/lib/operations/computeBatchOutputs'
import type { CalcInputRow } from '@/lib/purchasing/aggregate'

export type BatchOutputsResult = BatchOutputs & { batch: KitchenBatchWithItems }

export const batchService = {
  async getAll(): Promise<KitchenBatch[]> {
    const { data, error } = await supabase
      .from('kitchen_batches')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async getById(id: string): Promise<KitchenBatchWithItems> {
    const { data, error } = await supabase
      .from('kitchen_batches')
      .select(`
        *,
        kitchen_batch_items(
          id, batch_id, menu_id, pax_count,
          menu:menus(id, menu_code, menu_name),
          kitchen_batch_item_positions(position_id)
        )
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as KitchenBatchWithItems
  },

  async create(payload: KitchenBatchInsert): Promise<KitchenBatch> {
    const { data, error } = await supabase.from('kitchen_batches').insert(payload).select().single()
    if (error) throw error
    return data
  },

  async update(id: string, payload: KitchenBatchUpdate): Promise<KitchenBatch> {
    const { data, error } = await supabase
      .from('kitchen_batches')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('kitchen_batches').delete().eq('id', id)
    if (error) throw error
  },

  // Add or update a menu+pax line. Since the unique(batch_id,menu_id) constraint
  // was dropped (imports may carry the same menu several times with different
  // position selections), this manual entry path upserts by hand: update the
  // existing manual line for this menu if present, else insert a new one.
  async addItem(batchId: string, menuId: string, pax: number): Promise<void> {
    const { data: existing, error: findError } = await supabase
      .from('kitchen_batch_items')
      .select('id')
      .eq('batch_id', batchId)
      .eq('menu_id', menuId)
      .limit(1)
      .maybeSingle()
    if (findError) throw findError

    if (existing) {
      const { error } = await supabase
        .from('kitchen_batch_items')
        .update({ pax_count: pax })
        .eq('id', existing.id)
      if (error) throw error
      return
    }

    const { error } = await supabase
      .from('kitchen_batch_items')
      .insert({ batch_id: batchId, menu_id: menuId, pax_count: pax })
    if (error) throw error
  },

  async updateItemPax(itemId: string, pax: number): Promise<void> {
    const { error } = await supabase
      .from('kitchen_batch_items')
      .update({ pax_count: pax })
      .eq('id', itemId)
    if (error) throw error
  },

  async removeItem(itemId: string): Promise<void> {
    const { error } = await supabase.from('kitchen_batch_items').delete().eq('id', itemId)
    if (error) throw error
  },

  // ── the shared derivation: one batch → production + purchasing outputs ──
  async getOutputs(batchId: string): Promise<BatchOutputsResult> {
    const batch = await batchService.getById(batchId)
    const items = batch.kitchen_batch_items ?? []
    const menuIds = [...new Set(items.map((it) => it.menu_id))]

    const menus = await purchasingService.getMenusForCalc(menuIds)
    const menuById = new Map(menus.map((m) => [m.id, m]))

    // Pro Item: hat es gewählte Positionen (aus dem Bedarf-Import), wird das Menü
    // auf genau diese Positionen reduziert — sonst (manuelle Items) ganzes Menü.
    // Eine gefilterte KOPIE bauen, damit die geteilte menuById-Map unberührt bleibt.
    const rows: CalcInputRow[] = items
      .map((it) => {
        const menu = menuById.get(it.menu_id)
        if (!menu) return { menu: undefined, count: it.pax_count }
        const picked = (it.kitchen_batch_item_positions ?? []).map((p) => p.position_id)
        if (picked.length === 0) return { menu, count: it.pax_count }
        const pickedSet = new Set(picked)
        return {
          menu: { ...menu, menu_items: menu.menu_items.filter((mi) => mi.position_id && pickedSet.has(mi.position_id)) },
          count: it.pax_count,
        }
      })
      .filter((r): r is CalcInputRow => !!r.menu && r.count > 0)

    const ingredientIds = new Set<string>()
    for (const m of menus)
      for (const mi of m.menu_items) {
        if (mi.recipe) for (const ri of mi.recipe.recipe_ingredients) ingredientIds.add(ri.ingredient_id)
        for (const c of mi.components ?? []) {
          if (c.ingredient_id) ingredientIds.add(c.ingredient_id)
          if (c.recipe) for (const ri of c.recipe.recipe_ingredients) ingredientIds.add(ri.ingredient_id)
        }
      }

    const supplierProducts = await purchasingService.getSupplierProducts([...ingredientIds])

    const { data: units, error: unitErr } = await supabase
      .from('units')
      .select('id, unit_code, name, short_name')
    if (unitErr) throw unitErr

    return { batch, ...computeBatchOutputs(rows, units ?? [], supplierProducts) }
  },
}
