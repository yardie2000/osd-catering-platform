import { supabase } from '@/lib/supabase/client'
import type { Menu, MenuInsert, MenuUpdate, MenuPositionWithPosition } from '@/types'

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

  async getById(id: string): Promise<Menu> {
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
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

  // ── menu_positions (Position ↔ Menü, V5 Katalog) ────────────
  async getMenuPositions(menuId: string): Promise<MenuPositionWithPosition[]> {
    const { data, error } = await supabase
      .from('menu_positions')
      .select(`
        id, menu_id, position_id, sort_order, price_override, created_at,
        position:positions(id, position_code, name, description, dietary, allergens, default_price, notes, created_at, updated_at)
      `)
      .eq('menu_id', menuId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data ?? []) as unknown as MenuPositionWithPosition[]
  },

  async addPositionToMenu(menuId: string, positionId: string, sortOrder: number): Promise<void> {
    const { error } = await supabase
      .from('menu_positions')
      .insert({ menu_id: menuId, position_id: positionId, sort_order: sortOrder })
    if (error) throw error
  },

  async removeMenuPosition(id: string): Promise<void> {
    const { error } = await supabase.from('menu_positions').delete().eq('id', id)
    if (error) throw error
  },

  async setMenuPositionPrice(id: string, price: number | null): Promise<void> {
    const { error } = await supabase.from('menu_positions').update({ price_override: price }).eq('id', id)
    if (error) throw error
  },

  async reorderMenuPositions(items: { id: string; sort_order: number }[]): Promise<void> {
    for (const { id, sort_order } of items) {
      const { error } = await supabase.from('menu_positions').update({ sort_order }).eq('id', id)
      if (error) throw error
    }
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
