import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, PositionInsert, PositionComponentInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import {
  validateRows, positionRowSchema, menuPositionRowSchema, positionComponentRowSchema,
} from './ValidationEngine'

// ════════════════════════════════════════════════════════════
//  V5 — geteilter Positions-Katalog: Import-Blätter
//  positions · menu_positions · position_components
//  Matching durchgehend über *_code (position_code/menu_code/recipe_code/…).
// ════════════════════════════════════════════════════════════

interface PositionRow {
  position_code: string
  name:          string
  description?:  string | null
  dietary?:      string | null
  allergens:     string[]
  default_price?: number | null
}

interface MenuPositionRow {
  menu_code:      string
  position_code:  string
  sort_order:     number
  price_override?: number | null
}

interface PositionComponentRow {
  position_code:   string
  recipe_code?:    string | null
  ingredient_code?: string | null
  quantity?:       number | null
  unit_code?:      string | null
  sort_order:      number
}

export interface PositionImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
  // lower-cased position_code → Supabase UUID (incl. positions touched this run)
  positionCodeMap: Map<string, string>
}

// ── positions ────────────────────────────────────────────────
export async function importPositions(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean
): Promise<PositionImportResult> {
  const sheet = 'positions'
  const { valid, errors } = validateRows<PositionRow>(rows, positionRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'position' })
  )

  let inserted = 0
  let updated = 0
  let skipped = 0
  const positionCodeMap = new Map<string, string>()

  const { data: existing } = await client.from('positions').select('id, position_code')
  const existingByCode = new Map<string, string>(
    (existing ?? []).filter((p) => p.position_code).map((p) => [p.position_code!.trim().toLowerCase(), p.id])
  )

  const seen = new Set<string>()

  for (const row of valid) {
    const code = row.position_code.trim()
    const key = code.toLowerCase()

    // Duplicate position_code within this file → keep first, skip rest.
    if (seen.has(key)) {
      logger.warn(`Duplicate position_code "${code}" in import file — second occurrence skipped`, {
        source_sheet: sheet, entity_type: 'position', entity_code: code,
      })
      skipped++
      continue
    }
    seen.add(key)

    const payload: PositionInsert = {
      position_code: code,
      name:          row.name,
      description:   row.description ?? null,
      dietary:       row.dietary ?? null,
      allergens:     row.allergens ?? [],
      default_price: row.default_price ?? null,
    }

    const existingId = existingByCode.get(key)

    if (dryRun) {
      const fakeId = existingId ?? `dry-run-pos-${key}`
      positionCodeMap.set(key, fakeId)
      if (existingId) { updated++ } else { inserted++ }
      logger.info(`[DRY RUN] ${existingId ? 'Would update' : 'Would insert'} position: ${code} (${row.name})`, {
        source_sheet: sheet, entity_type: 'position', entity_code: code,
      })
      continue
    }

    if (existingId) {
      const { error } = await client.from('positions').update(payload).eq('id', existingId)
      if (error) {
        logger.error(`Failed to update position ${code}: ${error.message}`, { source_sheet: sheet, entity_type: 'position', entity_code: code })
        skipped++
      } else {
        updated++
        positionCodeMap.set(key, existingId)
      }
    } else {
      const { data, error } = await client.from('positions').insert(payload).select('id').single()
      if (error) {
        logger.error(`Failed to insert position ${code}: ${error.message}`, { source_sheet: sheet, entity_type: 'position', entity_code: code })
        skipped++
      } else {
        inserted++
        positionCodeMap.set(key, data.id)
      }
    }
  }

  logger.info(`Positions: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted, updated, skipped, errors: errors.length, positionCodeMap }
}

// ── menu_positions (Menü ↔ Position) ─────────────────────────
export async function importMenuPositions(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean,
  menuMap: Map<string, string>,
  positionCodeMap: Map<string, string>
): Promise<{ inserted: number; updated: number; skipped: number; errors: number }> {
  const sheet = 'menu_positions'
  const { valid, errors } = validateRows<MenuPositionRow>(rows, menuPositionRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'menu_position' })
  )

  // Resolve menus / positions by code — this run's maps overlaid on the live DB,
  // so links to menus/positions outside the current import still resolve.
  const menuByCode = new Map<string, string>()
  const { data: dbMenus } = await client.from('menus').select('id, menu_code')
  for (const m of dbMenus ?? []) if (m.menu_code) menuByCode.set(m.menu_code.trim().toLowerCase(), m.id)
  for (const [code, id] of menuMap) menuByCode.set(code.trim().toLowerCase(), id)

  const positionByCode = new Map<string, string>()
  const { data: dbPositions } = await client.from('positions').select('id, position_code')
  for (const p of dbPositions ?? []) if (p.position_code) positionByCode.set(p.position_code.trim().toLowerCase(), p.id)
  for (const [code, id] of positionCodeMap) positionByCode.set(code, id)

  let skipped = 0
  const links: { menu_id: string; position_id: string; sort_order: number; price_override: number | null }[] = []

  for (const row of valid) {
    const menuId = menuByCode.get(row.menu_code.trim().toLowerCase())
    const positionId = positionByCode.get(row.position_code.trim().toLowerCase())

    if (!menuId) {
      logger.error(`Menu code "${row.menu_code}" not found — menu_position skipped`, {
        source_sheet: sheet, entity_type: 'menu_position', entity_code: row.menu_code,
      })
      skipped++
      continue
    }
    if (!positionId) {
      logger.error(`Position code "${row.position_code}" not found — menu_position skipped`, {
        source_sheet: sheet, entity_type: 'menu_position', entity_code: row.position_code,
      })
      skipped++
      continue
    }

    links.push({
      menu_id:        menuId,
      position_id:    positionId,
      sort_order:     row.sort_order ?? 0,
      price_override: row.price_override ?? null,
    })
  }

  if (dryRun || links.some((l) => l.menu_id.startsWith('dry-run-') || l.position_id.startsWith('dry-run-'))) {
    logger.info(`[DRY RUN] Would upsert ${links.length} menu_positions`, { source_sheet: sheet, entity_type: 'menu_position' })
    return { inserted: links.length, updated: 0, skipped, errors: errors.length }
  }

  let upserted = 0
  if (links.length > 0) {
    // UNIQUE (menu_id, position_id) → upsert updates sort_order / price_override on re-import.
    const { error } = await client
      .from('menu_positions')
      .upsert(links, { onConflict: 'menu_id,position_id' })
    if (error) {
      logger.error(`Failed to upsert menu_positions: ${error.message}`, { source_sheet: sheet, entity_type: 'menu_position' })
      skipped += links.length
    } else {
      upserted = links.length
    }
  }

  logger.info(`Menu Positions: ${upserted} upserted, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted: upserted, updated: 0, skipped, errors: errors.length }
}

// ── position_components (Bestandteile, full-replace je Position) ──
export async function importPositionComponents(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean,
  positionCodeMap: Map<string, string>,
  recipeCodeMap: Map<string, string>
): Promise<{ inserted: number; skipped: number; errors: number }> {
  const sheet = 'position_components'
  const { valid, errors } = validateRows<PositionComponentRow>(rows, positionComponentRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'position_component' })
  )

  // ── Resolution maps (live DB overlaid with this run's code maps) ──
  const positionByCode = new Map<string, string>()
  const { data: dbPositions } = await client.from('positions').select('id, position_code')
  for (const p of dbPositions ?? []) if (p.position_code) positionByCode.set(p.position_code.trim().toLowerCase(), p.id)
  for (const [code, id] of positionCodeMap) positionByCode.set(code, id)

  const recipeByCode = new Map<string, string>()
  const { data: dbRecipes } = await client.from('recipes').select('id, recipe_code')
  for (const r of dbRecipes ?? []) if (r.recipe_code) recipeByCode.set(r.recipe_code.trim().toLowerCase(), r.id)
  for (const [code, id] of recipeCodeMap) recipeByCode.set(code, id)

  const ingredientByCode = new Map<string, string>()
  const { data: dbIngredients } = await client.from('ingredients').select('id, ingredient_code')
  for (const i of dbIngredients ?? []) if (i.ingredient_code) ingredientByCode.set(i.ingredient_code.trim().toLowerCase(), i.id)

  const unitByCode = new Map<string, string>()
  const { data: dbUnits } = await client.from('units').select('id, unit_code, name')
  for (const u of dbUnits ?? []) {
    if (u.unit_code) unitByCode.set(u.unit_code.trim().toLowerCase(), u.id)
    if (u.name) unitByCode.set(u.name.trim().toLowerCase(), u.id)
  }

  // ── Resolve each row → a component line, grouped by position ──
  let skipped = 0
  const grouped = new Map<string, PositionComponentInsert[]>()      // positionUuid → lines
  const positionCodeOf = new Map<string, string>()                   // positionUuid → original code (for logs)

  for (const row of valid) {
    const posCode = row.position_code.trim()
    const positionId = positionByCode.get(posCode.toLowerCase())
    if (!positionId) {
      logger.error(`Position code "${posCode}" not found — component skipped`, {
        source_sheet: sheet, entity_type: 'position_component', entity_code: posCode,
      })
      skipped++
      continue
    }
    positionCodeOf.set(positionId, posCode)

    const hasRecipe = !!row.recipe_code?.trim()
    const hasIngredient = !!row.ingredient_code?.trim()
    if (hasRecipe === hasIngredient) {
      logger.error(
        `Position "${posCode}": each component needs exactly one of recipe_code / ingredient_code — row skipped`,
        { source_sheet: sheet, entity_type: 'position_component', entity_code: posCode }
      )
      skipped++
      continue
    }

    let recipe_id: string | null = null
    let ingredient_id: string | null = null
    if (hasRecipe) {
      recipe_id = recipeByCode.get(row.recipe_code!.trim().toLowerCase()) ?? null
      if (!recipe_id) {
        logger.error(`Recipe code "${row.recipe_code}" not found (position ${posCode}) — component skipped`, {
          source_sheet: sheet, entity_type: 'position_component', entity_code: row.recipe_code ?? undefined,
        })
        skipped++
        continue
      }
    } else {
      ingredient_id = ingredientByCode.get(row.ingredient_code!.trim().toLowerCase()) ?? null
      if (!ingredient_id) {
        logger.error(`Ingredient code "${row.ingredient_code}" not found (position ${posCode}) — component skipped`, {
          source_sheet: sheet, entity_type: 'position_component', entity_code: row.ingredient_code ?? undefined,
        })
        skipped++
        continue
      }
    }

    // unit_code optional: null = Portionen (Rezept) bzw. unbenannt (Zutat).
    let unit_id: string | null = null
    if (row.unit_code?.trim()) {
      unit_id = unitByCode.get(row.unit_code.trim().toLowerCase()) ?? null
      if (!unit_id) {
        logger.warn(`Unit code "${row.unit_code}" not found (position ${posCode}) — component imported without unit`, {
          source_sheet: sheet, entity_type: 'position_component', entity_code: row.unit_code ?? undefined,
        })
      }
    }

    const qty = row.quantity != null && row.quantity > 0 ? row.quantity : 1

    const list = grouped.get(positionId) ?? []
    list.push({
      position_id: positionId,
      recipe_id,
      ingredient_id,
      quantity:    qty,
      unit_id,
      sort_order:  row.sort_order ?? list.length,
    })
    grouped.set(positionId, list)
  }

  // ── Full-replace components per affected position ──
  let inserted = 0
  for (const [positionId, lines] of grouped) {
    const posCode = positionCodeOf.get(positionId) ?? positionId

    if (dryRun || positionId.startsWith('dry-run-')) {
      inserted += lines.length
      logger.info(`[DRY RUN] Would replace components of position ${posCode} with ${lines.length} line(s)`, {
        source_sheet: sheet, entity_type: 'position_component', entity_code: posCode,
      })
      continue
    }

    const { error: delError } = await client.from('position_components').delete().eq('position_id', positionId)
    if (delError) {
      logger.error(`Failed to clear components of position ${posCode}: ${delError.message}`, {
        source_sheet: sheet, entity_type: 'position_component', entity_code: posCode,
      })
      skipped += lines.length
      continue
    }

    const { error: insError } = await client.from('position_components').insert(lines)
    if (insError) {
      logger.error(`Failed to insert components for position ${posCode}: ${insError.message}`, {
        source_sheet: sheet, entity_type: 'position_component', entity_code: posCode,
      })
      skipped += lines.length
    } else {
      inserted += lines.length
    }
  }

  logger.info(`Position Components: ${inserted} inserted, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted, skipped, errors: errors.length }
}
