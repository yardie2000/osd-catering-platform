import { supabase } from '@/lib/supabase/client'
import type {
  Recipe,
  RecipeInsert,
  RecipeUpdate,
  RecipeWithDetails,
  RecipeIngredientInsert,
} from '@/types'

type RecipeListOptions = {
  search?: string
  scalable?: boolean
}

export const recipesService = {
  async getAll(options?: RecipeListOptions): Promise<Recipe[]> {
    let query = supabase
      .from('recipes')
      .select('*')
      .order('name', { ascending: true })

    if (options?.search?.trim()) {
      const search = options.search.trim()
      query = query.or(`name.ilike.%${search}%,recipe_code.ilike.%${search}%`)
    }

    if (options?.scalable !== undefined) {
      query = query.eq('scalable', options.scalable)
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? []) as Recipe[]
  },

  async getById(id: string): Promise<RecipeWithDetails> {
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        *,
        yield_unit:units!recipes_yield_unit_id_fkey(*),
        recipe_ingredients(
          *,
          ingredient:ingredients(*),
          unit:units!recipe_ingredients_unit_id_fkey(*)
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    return data as RecipeWithDetails
  },

  async getByCode(code: string): Promise<Recipe | null> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('recipe_code', code)
      .maybeSingle()

    if (error) throw error

    return data as Recipe | null
  },

  async create(payload: RecipeInsert): Promise<Recipe> {
    const { data, error } = await supabase
      .from('recipes')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return data as Recipe
  },

  async update(id: string, payload: RecipeUpdate): Promise<Recipe> {
    const { data, error } = await supabase
      .from('recipes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return data as Recipe
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) throw error
  },

  async upsertIngredients(
    recipeId: string,
    ingredients: Omit<RecipeIngredientInsert, 'recipe_id'>[]
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId)

    if (deleteError) throw deleteError

    if (ingredients.length === 0) return

    const rows: RecipeIngredientInsert[] = ingredients.map((ingredient) => ({
      ...ingredient,
      recipe_id: recipeId,
    }))

    const { error } = await supabase.from('recipe_ingredients').insert(rows)

    if (error) throw error
  },

  async scaleRecipe(id: string, scaleFactor: number): Promise<RecipeWithDetails> {
    const recipe = await recipesService.getById(id)

    return {
      ...recipe,
      base_portions:
        recipe.base_portions != null ? recipe.base_portions * scaleFactor : null,
      yield_quantity:
        recipe.yield_quantity != null ? recipe.yield_quantity * scaleFactor : null,
      recipe_ingredients: recipe.recipe_ingredients.map((ri) => ({
        ...ri,
        quantity: ri.quantity * scaleFactor,
      })),
    }
  },

  async getAllergens(id: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('ingredient:ingredients(allergens)')
      .eq('recipe_id', id)

    if (error) throw error

    const allergens = new Set<string>()

    ;(data ?? []).forEach((row) => {
      const ingredient = row.ingredient as { allergens: string[] } | null
      ingredient?.allergens?.forEach((allergen) => allergens.add(allergen))
    })

    return [...allergens].sort()
  },

  // V5.1 — Backfill: set base_portions = yield_quantity for recipes that still
  // have no base_portions but a usable yield_quantity. Fills NULLs only,
  // derived from existing data (non-destructive). Returns the number updated.
  async backfillBasePortionsFromYield(): Promise<number> {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, yield_quantity')
      .is('base_portions', null)
      .not('yield_quantity', 'is', null)

    if (error) throw error

    const targets = (data ?? []).filter(
      (row): row is { id: string; yield_quantity: number } =>
        row.yield_quantity != null && row.yield_quantity > 0
    )

    for (const recipe of targets) {
      const { error: updateError } = await supabase
        .from('recipes')
        .update({ base_portions: recipe.yield_quantity })
        .eq('id', recipe.id)
      if (updateError) throw updateError
    }

    return targets.length
  },
}
