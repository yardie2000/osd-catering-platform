import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, MenuInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import { validateRows, menuRowSchemaV3 } from './ValidationEngine'

interface MenuRowV3 {
  menu_code: string
  menu_name: string
  menu_description?: string | null
  category?: string | null
  price_per_person?: number | null
  active?: boolean
}

export interface MenuImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
  menuMap: Map<string, string>  // menu_code → Supabase UUID
}

export async function importMenus(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean
): Promise<MenuImportResult> {
  const sheet = 'menus'
  const { valid, errors } = validateRows<MenuRowV3>(rows, menuRowSchemaV3, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, {
      row_number: e.row,
      source_sheet: sheet,
      entity_type: 'menu',
      entity_code: String((rows[e.row - 1] as Record<string, unknown>)?.menu_code ?? ''),
    })
  )

  let inserted = 0
  let updated = 0
  let skipped = 0
  const menuMap = new Map<string, string>()

  const { data: existing } = await client.from('menus').select('id,menu_code')
  const existingMap = new Map<string, string>(
    (existing ?? []).map((m) => [m.menu_code, m.id])
  )

  for (const row of valid) {
    const menuCode = row.menu_code

    // Duplicate check within this import batch
    if (menuMap.has(menuCode) && !existingMap.has(menuCode)) {
      logger.warn(`Duplicate menu_code "${menuCode}" in import file — second occurrence skipped`, {
        source_sheet: sheet, entity_type: 'menu', entity_code: menuCode,
      })
      skipped++
      continue
    }

    const payload: MenuInsert = {
      menu_code:       menuCode,
      menu_name:       row.menu_name,
      menu_description:row.menu_description ?? null,
      category:        row.category ?? null,
      price_per_person:row.price_per_person ?? null,
      active:          row.active ?? true,
    }

    const existingId = existingMap.get(menuCode)

    if (dryRun) {
      if (existingId) {
        updated++
        menuMap.set(menuCode, existingId)
        logger.info(`[DRY RUN] Would update menu: ${menuCode}`, {
          source_sheet: sheet, entity_type: 'menu', entity_code: menuCode,
        })
      } else {
        inserted++
        menuMap.set(menuCode, `dry-run-${menuCode}`)
        logger.info(`[DRY RUN] Would insert menu: ${menuCode}`, {
          source_sheet: sheet, entity_type: 'menu', entity_code: menuCode,
        })
      }
      continue
    }

    if (existingId) {
      const { error } = await client.from('menus').update(payload).eq('id', existingId)
      if (error) {
        logger.error(`Failed to update menu ${menuCode}: ${error.message}`, {
          source_sheet: sheet, entity_type: 'menu', entity_code: menuCode,
        })
        skipped++
      } else {
        updated++
        menuMap.set(menuCode, existingId)
      }
    } else {
      const { data, error } = await client.from('menus').insert(payload).select('id').single()
      if (error) {
        logger.error(`Failed to insert menu ${menuCode}: ${error.message}`, {
          source_sheet: sheet, entity_type: 'menu', entity_code: menuCode,
        })
        skipped++
      } else {
        inserted++
        menuMap.set(menuCode, data.id)
      }
    }
  }

  logger.info(
    `Menus: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors.length} errors`,
    { source_sheet: sheet }
  )
  return { inserted, updated, skipped, errors: errors.length, menuMap }
}
