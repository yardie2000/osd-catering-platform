import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, UnitInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import { validateRows, unitRowSchema } from './ValidationEngine'

interface UnitRow {
  unit_id: number
  unit_name: string
}

export interface UnitImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
  // Maps Excel numeric unit_id → Supabase UUID
  unitIdMap: Map<number, string>
  // Maps unit_name → Supabase UUID (for other lookups)
  unitNameMap: Map<string, string>
}

function makeUnitCode(name: string, id: number): string {
  const slug = name.trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 20)
  return slug || `unit_${id}`
}

export async function importUnits(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean
): Promise<UnitImportResult> {
  const sheet = 'units'
  const { valid, errors } = validateRows<UnitRow>(rows, unitRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, { row_number: e.row, source_sheet: sheet, entity_type: 'unit' })
  )

  let inserted = 0
  let updated = 0
  let skipped = 0
  const unitIdMap = new Map<number, string>()
  const unitNameMap = new Map<string, string>()

  // Load all existing units keyed by unit_code
  const { data: existing } = await client.from('units').select('id,unit_code,name')
  const existingByCode = new Map<string, string>((existing ?? []).map((u) => [u.unit_code, u.id]))
  const existingByName = new Map<string, string>((existing ?? []).map((u) => [u.name.toLowerCase(), u.id]))

  for (const row of valid) {
    const unitCode = makeUnitCode(row.unit_name, row.unit_id)
    const existingId = existingByCode.get(unitCode) ?? existingByName.get(row.unit_name.toLowerCase())

    const payload: UnitInsert = {
      unit_code: unitCode,
      name: row.unit_name,
      short_name: row.unit_name,
      base_unit: null,
      conversion_factor: null,
    }

    if (dryRun) {
      const fakeId = existingId ?? `dry-run-unit-${row.unit_id}`
      unitIdMap.set(row.unit_id, fakeId)
      unitNameMap.set(row.unit_name.toLowerCase(), fakeId)
      if (existingId) { updated++ } else { inserted++ }
      logger.info(`[DRY RUN] ${existingId ? 'Would update' : 'Would insert'} unit: ${unitCode}`, {
        source_sheet: sheet, entity_type: 'unit', entity_code: unitCode,
      })
      continue
    }

    if (existingId) {
      const { error } = await client.from('units').update(payload).eq('id', existingId)
      if (error) {
        logger.error(`Failed to update unit ${unitCode}: ${error.message}`, { source_sheet: sheet, entity_type: 'unit', entity_code: unitCode })
        skipped++
      } else {
        updated++
        unitIdMap.set(row.unit_id, existingId)
        unitNameMap.set(row.unit_name.toLowerCase(), existingId)
      }
    } else {
      const { data, error } = await client.from('units').insert(payload).select('id').single()
      if (error) {
        logger.error(`Failed to insert unit ${unitCode}: ${error.message}`, { source_sheet: sheet, entity_type: 'unit', entity_code: unitCode })
        skipped++
      } else {
        inserted++
        unitIdMap.set(row.unit_id, data.id)
        unitNameMap.set(row.unit_name.toLowerCase(), data.id)
      }
    }
  }

  logger.info(`Units: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors.length} errors`, { source_sheet: sheet })
  return { inserted, updated, skipped, errors: errors.length, unitIdMap, unitNameMap }
}
