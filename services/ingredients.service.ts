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

  /**
   * Zuordnung Zutat → Rezepte, in denen sie verwendet wird (über recipe_ingredients).
   * Ein Query, danach client-seitig gruppiert und dedupliziert. Für die Zutatenliste.
   */
  async getRecipeUsage(): Promise<Record<string, { id: string; name: string }[]>> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('ingredient_id, recipe:recipes!recipe_ingredients_recipe_id_fkey(id, name)')

    if (error) throw error

    type Row = { ingredient_id: string; recipe: { id: string; name: string } | null }
    const map: Record<string, { id: string; name: string }[]> = {}
    for (const row of (data ?? []) as unknown as Row[]) {
      if (!row.recipe) continue
      ;(map[row.ingredient_id] ??= []).push(row.recipe)
    }
    for (const key of Object.keys(map)) {
      const seen = new Set<string>()
      map[key] = map[key]
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    }
    return map
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