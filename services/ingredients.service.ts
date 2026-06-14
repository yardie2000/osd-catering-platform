import { supabase } from '@/lib/supabase/client'
import type { Ingredient, IngredientInsert, IngredientUpdate, IngredientWithUnit } from '@/types'

type IngredientListOptions = {
  search?: string
  category?: string
}

export const ingredientsService = {
  async getAll(options?: IngredientListOptions): Promise<IngredientWithUnit[]> {
    let query = supabase
      .from('ingredients')
      .select(`
        *,
        default_unit:units!ingredients_default_unit_id_fkey(*)
      `)
      .order('name', { ascending: true })

    if (options?.search?.trim()) {
      const search = options.search.trim()
      query = query.or(`name.ilike.%${search}%,ingredient_code.ilike.%${search}%`)
    }

    if (options?.category?.trim()) {
      query = query.eq('category', options.category.trim())
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? []) as unknown as IngredientWithUnit[]
  },

  async getById(id: string): Promise<IngredientWithUnit> {
    const { data, error } = await supabase
      .from('ingredients')
      .select(`
        *,
        default_unit:units!ingredients_default_unit_id_fkey(*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return data as IngredientWithUnit
  },

  async getByCode(code: string): Promise<Ingredient | null> {
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('ingredient_code', code)
      .maybeSingle()

    if (error) throw error

    return data as Ingredient | null
  },

  async create(payload: IngredientInsert): Promise<Ingredient> {
    const { data, error } = await supabase
      .from('ingredients')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return data as Ingredient
  },

  async update(id: string, payload: IngredientUpdate): Promise<Ingredient> {
    const { data, error } = await supabase
      .from('ingredients')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return data as Ingredient
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('ingredients')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('ingredients')
      .select('category')
      .not('category', 'is', null)

    if (error) throw error

    const unique = new Set<string>()

    ;(data ?? []).forEach((row) => {
      const category = row.category?.trim()
      if (category) unique.add(category)
    })

    return [...unique].sort((a, b) => a.localeCompare(b, 'de'))
  },
}