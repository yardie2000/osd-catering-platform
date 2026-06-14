import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, RecipeInsert, RecipeIngredientInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import { validateRows, recipeRowSchema, recipeIngredientRowSchema, parseGermanNumber, parseYieldString } from './ValidationEngine'

interface RecipeRow {
  recipe_id: number
  component_id?: string | null
  recipe_name: string
  preparation?: string | null
  yield?: string | null
  critical_note?: string | null
  shelf_life?: string | null
  usage?: string | null
  comment?: string | null
}

interface RecipeIngredientRow {
  recipe_ingredient_id: number
  recipe_id: number
  ingredient_id: number
  quantity: string | number | null
  unit_id: number
  supplier?: string | null
}

export interface RecipeImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
  // Maps Excel numeric recipe_id → Supabase UUID
  recipeIdMap: Map<number, string>
  // Maps lower-cased recipe_code → Supabase UUID (used by MenuItemImporter
  // to link menu lines to recipes by code, incl. recipes inserted this run).
  recipeCodeMap: Map<string, string>
}

function makeRecipeCode(row: RecipeRow): string {
  if (row.component_id && row.component_id.trim()) return row.component_id.trim()
  return `REC-${String(row.recipe_id).padStart(4, '0')}`
}

export async function importRecipes(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean
): Promise<RecipeImportResult> {
  const sheet = 'recipes'
  const { valid, errors } = validateRows<RecipeRow>(rows, recipeRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'recipe' })
  )

  let inserted = 0
  let updated = 0
  let skipped = 0
  const recipeIdMap = new Map<number, string>()
  const recipeCodeMap = new Map<string, string>()

  const { data: existing } = await client.from('recipes').select('id,recipe_code')
  const existingByCode = new Map<string, string>((existing ?? []).map((r) => [r.recipe_code, r.id]))

  for (const row of valid) {
    const code = makeRecipeCode(row)
    const existingId = existingByCode.get(code)

    const { quantity: yieldQty, notes: yieldNotes } = parseYieldString(row.yield)

    const payload: RecipeInsert = {
      recipe_code: code,
      name: row.recipe_name,
      description: [row.comment, yieldNotes].filter(Boolean).join(' — ') || null,
      yield_quantity: yieldQty,
      yield_unit_id: null,
      preparation: row.preparation ?? null,
      usage_notes: row.usage ?? null,
      production_notes: row.critical_note ?? null,
      shelf_life: row.shelf_life ?? null,
      scalable: true,
    }

    if (dryRun) {
      const fakeId = existingId ?? `dry-run-rec-${row.recipe_id}`
      recipeIdMap.set(row.recipe_id, fakeId)
      recipeCodeMap.set(code.toLowerCase(), fakeId)
      if (existingId) { updated++ } else { inserted++ }
      logger.info(`[DRY RUN] ${existingId ? 'Would update' : 'Would insert'} recipe: ${code} (${row.recipe_name})`, {
        source_sheet: sheet, entity_type: 'recipe', entity_code: code,
      })
      continue
    }

    if (existingId) {
      const { error } = await client.from('recipes').update(payload).eq('id', existingId)
      if (error) {
        logger.error(`Failed to update recipe ${code}: ${error.message}`, { source_sheet: sheet, entity_type: 'recipe', entity_code: code })
        skipped++
      } else {
        updated++
        recipeIdMap.set(row.recipe_id, existingId)
        recipeCodeMap.set(code.toLowerCase(), existingId)
      }
    } else {
      const { data, error } = await client.from('recipes').insert(payload).select('id').single()
      if (error) {
        logger.error(`Failed to insert recipe ${code}: ${error.message}`, { source_sheet: sheet, entity_type: 'recipe', entity_code: code })
        skipped++
      } else {
        inserted++
        recipeIdMap.set(row.recipe_id, data.id)
        recipeCodeMap.set(code.toLowerCase(), data.id)
      }
    }
  }

  logger.info(`Recipes: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted, updated, skipped, errors: errors.length, recipeIdMap, recipeCodeMap }
}

export async function importRecipeIngredients(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean,
  recipeIdMap: Map<number, string>,
  ingredientIdMap: Map<number, string>,
  unitIdMap: Map<number, string>
): Promise<{ inserted: number; skipped: number; errors: number }> {
  const sheet = 'recipe_ingredients'
  const { valid, errors } = validateRows<RecipeIngredientRow>(rows, recipeIngredientRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'recipe_ingredient' })
  )

  let inserted = 0
  let skipped = 0

  // Group by recipe_id so we can do a full replace per recipe
  const grouped = new Map<number, RecipeIngredientRow[]>()
  for (const row of valid) {
    const list = grouped.get(row.recipe_id) ?? []
    list.push(row)
    grouped.set(row.recipe_id, list)
  }

  for (const [excelRecipeId, ingredientRows] of grouped) {
    const recipeUuid = recipeIdMap.get(excelRecipeId)
    if (!recipeUuid || recipeUuid.startsWith('dry-run-')) {
      logger.warn(`Recipe ID ${excelRecipeId} not found in import map — skipping its ingredients`, {
        source_sheet: sheet, entity_type: 'recipe_ingredient',
      })
      skipped += ingredientRows.length
      continue
    }

    const lines: RecipeIngredientInsert[] = []
    for (const row of ingredientRows) {
      const ingredientUuid = ingredientIdMap.get(row.ingredient_id)
      const unitUuid = unitIdMap.get(row.unit_id)

      if (!ingredientUuid) {
        logger.error(`Ingredient ID ${row.ingredient_id} not in map (recipe_id ${excelRecipeId})`, {
          source_sheet: sheet, entity_type: 'recipe_ingredient',
        })
        skipped++
        continue
      }
      if (!unitUuid) {
        logger.error(`Unit ID ${row.unit_id} not in map (recipe_id ${excelRecipeId})`, {
          source_sheet: sheet, entity_type: 'recipe_ingredient',
        })
        skipped++
        continue
      }

      const qty = parseGermanNumber(row.quantity)
      if (!qty || qty <= 0) {
        logger.warn(`Invalid quantity "${row.quantity}" for recipe_id ${excelRecipeId} ingredient ${row.ingredient_id} — defaulting to 1`, {
          source_sheet: sheet, entity_type: 'recipe_ingredient',
        })
      }

      lines.push({
        recipe_id: recipeUuid,
        ingredient_id: ingredientUuid,
        quantity: qty && qty > 0 ? qty : 1,
        unit_id: unitUuid,
        supplier: row.supplier ?? null,
        notes: null,
        package_qty: null,
        package_unit: null,
      })
    }

    if (dryRun) {
      inserted += lines.length
      logger.info(`[DRY RUN] Would insert ${lines.length} ingredients for recipe_id ${excelRecipeId}`, {
        source_sheet: sheet, entity_type: 'recipe_ingredient',
      })
      continue
    }

    // Delete existing ingredient lines for this recipe then re-insert
    await client.from('recipe_ingredients').delete().eq('recipe_id', recipeUuid)

    if (lines.length > 0) {
      const { error } = await client.from('recipe_ingredients').insert(lines)
      if (error) {
        logger.error(`Failed to insert ingredients for recipe_id ${excelRecipeId}: ${error.message}`, {
          source_sheet: sheet, entity_type: 'recipe_ingredient',
        })
        skipped += lines.length
      } else {
        inserted += lines.length
      }
    }
  }

  logger.info(`Recipe ingredients: ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted, skipped, errors: errors.length }
}
