import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, MenuItemInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import { validateRows, menuItemRowSchema } from './ValidationEngine'

interface MenuItemRow {
  menu_code:    string
  name:         string
  recipe_code?: string | null
  description?: string | null
  dietary?:     string | null
  allergens?:   string[]
  item_price?:  number | null
  sort_order?:  number
}

export interface MenuItemImportResult {
  inserted: number
  skipped: number
  errors: number
  linked: number
  unlinked: number
}

export async function importMenuItems(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean,
  menuMap: Map<string, string>,
  recipeCodeMap: Map<string, string>
): Promise<MenuItemImportResult> {
  const sheet = 'menu_items'
  const { valid, errors } = validateRows<MenuItemRow>(rows, menuItemRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, {
      row_number: e.row,
      source_sheet: sheet,
      entity_type: 'menu_item',
    })
  )

  let inserted = 0
  let skipped = 0
  let linked = 0
  let unlinked = 0

  // ── Build a robust recipe lookup ───────────────────────────
  // Pull every recipe already in the DB so we can resolve links to
  // recipes that are NOT part of this import. Then overlay the
  // per-run code map (covers recipes inserted in this same run /
  // dry-run fakes). Names are kept only when unique to avoid
  // linking to the wrong recipe.
  const codeToId = new Map<string, string>()
  const nameToIds = new Map<string, string[]>()

  const { data: dbRecipes, error: recipeFetchError } = await client
    .from('recipes')
    .select('id, recipe_code, name')

  if (recipeFetchError) {
    logger.warn(
      `Could not load recipes for menu-item linking: ${recipeFetchError.message}. Items will be imported without recipe links.`,
      { source_sheet: sheet, entity_type: 'menu_item' }
    )
  }

  for (const r of dbRecipes ?? []) {
    if (r.recipe_code) codeToId.set(r.recipe_code.trim().toLowerCase(), r.id)
    if (r.name) {
      const key = r.name.trim().toLowerCase()
      const list = nameToIds.get(key) ?? []
      list.push(r.id)
      nameToIds.set(key, list)
    }
  }
  // Overlay this run's codes (recipeCodeMap keys are already lower-cased).
  for (const [code, id] of recipeCodeMap) codeToId.set(code, id)

  const warnedCodes = new Set<string>()

  // Resolve a menu line → recipe_id. Prefers explicit recipe_code,
  // then an exact-unique recipe name; returns null when unresolved.
  function resolveRecipeId(row: MenuItemRow): string | null {
    const code = row.recipe_code?.trim().toLowerCase()
    if (code) {
      const byCode = codeToId.get(code)
      if (byCode) return byCode
      if (!warnedCodes.has(code)) {
        logger.warn(
          `Recipe code "${row.recipe_code}" not found — menu line "${row.name}" imported without a recipe link`,
          { source_sheet: sheet, entity_type: 'menu_item', entity_code: row.recipe_code ?? undefined }
        )
        warnedCodes.add(code)
      }
      return null
    }
    const byName = nameToIds.get(row.name.trim().toLowerCase())
    if (byName && byName.length === 1) return byName[0]
    return null
  }

  // Group rows by menu_code so we can do a full replace per menu
  const grouped = new Map<string, MenuItemRow[]>()
  for (const row of valid) {
    const list = grouped.get(row.menu_code) ?? []
    list.push(row)
    grouped.set(row.menu_code, list)
  }

  const missingMenuCodes = new Set<string>()

  for (const [menuCode, itemRows] of grouped) {
    const menuUuid = menuMap.get(menuCode)
    if (!menuUuid) {
      if (!missingMenuCodes.has(menuCode)) {
        logger.error(
          `Menu code "${menuCode}" not found — did the Menus sheet import succeed? Skipping ${itemRows.length} items`,
          { source_sheet: sheet, entity_type: 'menu_item', entity_code: menuCode }
        )
        missingMenuCodes.add(menuCode)
      }
      skipped += itemRows.length
      continue
    }

    const lines: MenuItemInsert[] = itemRows.map((row, i) => {
      const recipe_id = resolveRecipeId(row)
      if (recipe_id) { linked++ } else { unlinked++ }
      return {
        menu_id:     menuUuid,
        recipe_id,
        name:        row.name,
        description: row.description ?? null,
        dietary:     row.dietary ?? null,
        allergens:   row.allergens ?? [],
        item_price:  row.item_price ?? null,
        sort_order:  row.sort_order ?? i,
      }
    })

    if (dryRun || menuUuid.startsWith('dry-run-')) {
      inserted += lines.length
      logger.info(
        `[DRY RUN] Would insert ${lines.length} menu_items for menu ${menuCode}`,
        { source_sheet: sheet, entity_type: 'menu_item', entity_code: menuCode }
      )
      continue
    }

    // Full replace: delete current items for this menu, then re-insert
    const { error: delError } = await client
      .from('menu_items')
      .delete()
      .eq('menu_id', menuUuid)

    if (delError) {
      logger.error(`Failed to clear menu_items for ${menuCode}: ${delError.message}`, {
        source_sheet: sheet, entity_type: 'menu_item', entity_code: menuCode,
      })
      skipped += lines.length
      continue
    }

    if (lines.length > 0) {
      const { error: insError } = await client.from('menu_items').insert(lines)
      if (insError) {
        logger.error(`Failed to insert menu_items for ${menuCode}: ${insError.message}`, {
          source_sheet: sheet, entity_type: 'menu_item', entity_code: menuCode,
        })
        skipped += lines.length
      } else {
        inserted += lines.length
      }
    }
  }

  logger.info(
    `Menu Items: ${inserted} inserted (${linked} linked to recipes, ${unlinked} without recipe), ` +
    `${skipped} skipped, ${errors.length} errors`,
    { source_sheet: sheet }
  )
  return { inserted, skipped, errors: errors.length, linked, unlinked }
}
