import { supabase } from '@/lib/supabase/client'
import type { Menu, MenuInsert, MenuUpdate, MenuWithItems, MenuItemInsert, MenuItemUpdate } from '@/types'

export const menusService = {
  async getAll(options?: { active?: boolean; search?: string; category?: string }): Promise<Menu[]> {
    let query = supabase.from('menus').select('*').order('menu_name')

    if (options?.active !== undefined) query = query.eq('active', options.active)
    if (options?.category)            query = query.eq('category', options.category)
    if (options?.search) {
      query = query.or(`menu_name.ilike.%${options.search}%,menu_code.ilike.%${options.search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return data
  },

  async getById(id: string): Promise<MenuWithItems> {
    const { data, error } = await supabase
      .from('menus')
      .select(`
        *,
        menu_items(
          *,
          recipe:recipes(*)
        )
      `)
      .eq('id', id)
      .order('sort_order', { referencedTable: 'menu_items' })
      .single()
    if (error) throw error
    return data as MenuWithItems
  },

  async getByCode(code: string): Promise<Menu | null> {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('menu_code', code)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async create(payload: MenuInsert): Promise<Menu> {
    const { data, error } = await supabase
      .from('menus')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, payload: MenuUpdate): Promise<Menu> {
    const { data, error } = await supabase
      .from('menus')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('menus').delete().eq('id', id)
    if (error) throw error
  },

  async upsertItems(
    menuId: string,
    items: Omit<MenuItemInsert, 'menu_id'>[]
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('menu_id', menuId)
    if (deleteError) throw deleteError

    if (items.length === 0) return

    const rows = items.map((item, i) => ({
      ...item,
      menu_id:    menuId,
      sort_order: item.sort_order ?? i,
    }))
    const { error } = await supabase.from('menu_items').insert(rows)
    if (error) throw error
  },

  async addItem(
    menuId: string,
    item: {
      name: string
      description?: string | null
      dietary?: string | null
      item_price?: number | null
      recipe_id?: string | null
    },
    sortOrder: number
  ): Promise<void> {
    const { error } = await supabase.from('menu_items').insert({
      menu_id:     menuId,
      name:        item.name,
      description: item.description ?? null,
      dietary:     item.dietary ?? null,
      item_price:  item.item_price ?? null,
      recipe_id:   item.recipe_id ?? null,
      sort_order:  sortOrder,
    })
    if (error) throw error
  },

  async updateItem(menuItemId: string, patch: MenuItemUpdate): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .update(patch)
      .eq('id', menuItemId)
    if (error) throw error
  },

  // Link / change / clear the recipe behind a menu line (recipeId = null unlinks).
  async setItemRecipe(menuItemId: string, recipeId: string | null): Promise<void> {
    const { error } = await supabase
      .from('menu_items')
      .update({ recipe_id: recipeId })
      .eq('id', menuItemId)
    if (error) throw error
  },

  // Persist a new ordering. Lists are short, so sequential updates are fine.
  async reorderItems(items: { id: string; sort_order: number }[]): Promise<void> {
    for (const { id, sort_order } of items) {
      const { error } = await supabase
        .from('menu_items')
        .update({ sort_order })
        .eq('id', id)
      if (error) throw error
    }
  },

  async removeItem(menuItemId: string): Promise<void> {
    const { error } = await supabase.from('menu_items').delete().eq('id', menuItemId)
    if (error) throw error
  },

  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('menus')
      .select('category')
      .not('category', 'is', null)
      .order('category')
    if (error) throw error
    return [...new Set((data as { category: string | null }[]).map((d) => d.category).filter(Boolean) as string[])]
  },
}
