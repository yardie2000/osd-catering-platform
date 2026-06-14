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
          menu:menus(id, menu_code, menu_name)
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

  // Add or update a menu+pax line (unique per batch+menu → upsert updates pax).
  async addItem(batchId: string, menuId: string, pax: number): Promise<void> {
    const { error } = await supabase
      .from('kitchen_batch_items')
      .upsert({ batch_id: batchId, menu_id: menuId, pax_count: pax }, { onConflict: 'batch_id,menu_id' })
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

    const rows: CalcInputRow[] = items
      .map((it) => ({ menu: menuById.get(it.menu_id), count: it.pax_count }))
      .filter((r): r is CalcInputRow => !!r.menu && r.count > 0)

    const ingredientIds = new Set<string>()
    for (const m of menus)
      for (const mi of m.menu_items)
        if (mi.recipe) for (const ri of mi.recipe.recipe_ingredients) ingredientIds.add(ri.ingredient_id)

    const supplierProducts = await purchasingService.getSupplierProducts([...ingredientIds])

    const { data: units, error: unitErr } = await supabase
      .from('units')
      .select('id, unit_code, name, short_name')
    if (unitErr) throw unitErr

    return { batch, ...computeBatchOutputs(rows, units ?? [], supplierProducts) }
  },
}
