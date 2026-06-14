import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, IngredientInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import { validateRows, ingredientRowSchema } from './ValidationEngine'

interface IngredientRow {
  ingredient_id: number
  ingredient_name: string
}

export interface IngredientImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
  // Maps Excel numeric ingredient_id → Supabase UUID
  ingredientIdMap: Map<number, string>
}

function makeIngredientCode(id: number): string {
  return `ING-${String(id).padStart(4, '0')}`
}

export async function importIngredients(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean
): Promise<IngredientImportResult> {
  const sheet = 'ingredients'
  const { valid, errors } = validateRows<IngredientRow>(rows, ingredientRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'ingredient' })
  )

  let inserted = 0
  let updated = 0
  let skipped = 0
  const ingredientIdMap = new Map<number, string>()

  const { data: existing } = await client.from('ingredients').select('id,ingredient_code,name')
  const existingByCode = new Map<string, string>((existing ?? []).map((i) => [i.ingredient_code, i.id]))
  const existingByName = new Map<string, string>((existing ?? []).map((i) => [i.name.toLowerCase(), i.id]))

  for (const row of valid) {
    const code = makeIngredientCode(row.ingredient_id)
    const existingId = existingByCode.get(code) ?? existingByName.get(row.ingredient_name.toLowerCase())

    const payload: IngredientInsert = {
      ingredient_code: code,
      name: row.ingredient_name,
      category: null,
      default_unit_id: null,
      supplier_name: null,
      allergens: [],
      notes: null,
    }

    if (dryRun) {
      const fakeId = existingId ?? `dry-run-ing-${row.ingredient_id}`
      ingredientIdMap.set(row.ingredient_id, fakeId)
      if (existingId) { updated++ } else { inserted++ }
      logger.info(`[DRY RUN] ${existingId ? 'Would update' : 'Would insert'} ingredient: ${code} (${row.ingredient_name})`, {
        source_sheet: sheet, entity_type: 'ingredient', entity_code: code,
      })
      continue
    }

    if (existingId) {
      const { error } = await client.from('ingredients').update(payload).eq('id', existingId)
      if (error) {
        logger.error(`Failed to update ingredient ${code}: ${error.message}`, { source_sheet: sheet, entity_type: 'ingredient', entity_code: code })
        skipped++
      } else {
        updated++
        ingredientIdMap.set(row.ingredient_id, existingId)
      }
    } else {
      const { data, error } = await client.from('ingredients').insert(payload).select('id').single()
      if (error) {
        logger.error(`Failed to insert ingredient ${code}: ${error.message}`, { source_sheet: sheet, entity_type: 'ingredient', entity_code: code })
        skipped++
      } else {
        inserted++
        ingredientIdMap.set(row.ingredient_id, data.id)
      }
    }
  }

  logger.info(`Ingredients: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted, updated, skipped, errors: errors.length, ingredientIdMap }
}
