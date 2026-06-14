import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, SupplierProductInsert } from '@/types'
import { ImportLogger } from './ImportLogger'
import { validateRows, supplierRowSchema } from './ValidationEngine'

interface SupplierRow {
  ingredient_id: number
  supplier_name: string
  package_description?: string | null
  package_quantity?: number | null
  package_unit?: string | null
  minimum_order_quantity?: number | null
  supplier_sku?: string | null
  supplier_pack_price?: number | null
  lead_time_days?: number | null
}

export interface SupplierImportResult {
  inserted: number
  updated: number
  skipped: number
  errors: number
}

export async function importSuppliers(
  client: SupabaseClient<Database>,
  rows: unknown[],
  logger: ImportLogger,
  dryRun: boolean,
  ingredientIdMap: Map<number, string>
): Promise<SupplierImportResult> {
  const sheet = 'suppliers'
  const { valid, errors } = validateRows<SupplierRow>(rows, supplierRowSchema, sheet)

  errors.forEach((e) =>
    logger.error(`Validation: ${e.message}`, {
      row_number: e.row,
      source_sheet: sheet,
      entity_type: 'supplier_product',
    })
  )

  let inserted = 0
  let updated = 0
  let skipped = 0

  // Load existing supplier_products once for lookup
  const { data: existing } = await client
    .from('supplier_products')
    .select('id,ingredient_id,supplier_name')

  type ExistingRow = { id: string; ingredient_id: string; supplier_name: string }
  const existingMap = new Map<string, string>(
    (existing ?? []).map((r: ExistingRow) => [`${r.ingredient_id}::${r.supplier_name}`, r.id])
  )

  for (const row of valid) {
    const ingredientUuid = ingredientIdMap.get(row.ingredient_id)
    if (!ingredientUuid) {
      logger.warn(
        `Supplier row: ingredient_id ${row.ingredient_id} not found in import map — skipped`,
        { source_sheet: sheet, entity_type: 'supplier_product', entity_code: String(row.ingredient_id) }
      )
      skipped++
      continue
    }

    if (dryRun && ingredientUuid.startsWith('dry-run-')) {
      logger.info(
        `[DRY RUN] Would upsert supplier_product for ingredient ${row.ingredient_id} / ${row.supplier_name}`,
        { source_sheet: sheet, entity_type: 'supplier_product', entity_code: row.supplier_name }
      )
      inserted++
      continue
    }

    const payload: SupplierProductInsert = {
      ingredient_id:          ingredientUuid,
      supplier_name:          row.supplier_name,
      supplier_article_number:null,
      package_description:    row.package_description ?? null,
      package_quantity:       row.package_quantity ?? null,
      package_unit:           row.package_unit ?? null,
      minimum_order_quantity: row.minimum_order_quantity ?? null,
      supplier_sku:           row.supplier_sku ?? null,
      supplier_pack_price:    row.supplier_pack_price ?? null,
      lead_time_days:         row.lead_time_days ?? null,
      active:                 true,
    }

    const existingKey = `${ingredientUuid}::${row.supplier_name}`
    const existingId = existingMap.get(existingKey)

    if (dryRun) {
      if (existingId) {
        updated++
        logger.info(
          `[DRY RUN] Would update supplier_product for ${row.supplier_name}`,
          { source_sheet: sheet, entity_type: 'supplier_product', entity_code: row.supplier_name }
        )
      } else {
        inserted++
        logger.info(
          `[DRY RUN] Would insert supplier_product for ${row.supplier_name}`,
          { source_sheet: sheet, entity_type: 'supplier_product', entity_code: row.supplier_name }
        )
      }
      continue
    }

    if (existingId) {
      const { error } = await client
        .from('supplier_products')
        .update(payload)
        .eq('id', existingId)
      if (error) {
        logger.error(
          `Failed to update supplier_product ${row.supplier_name}: ${error.message}`,
          { source_sheet: sheet, entity_type: 'supplier_product', entity_code: row.supplier_name }
        )
        skipped++
      } else {
        updated++
      }
    } else {
      const { error } = await client.from('supplier_products').insert(payload)
      if (error) {
        logger.error(
          `Failed to insert supplier_product ${row.supplier_name}: ${error.message}`,
          { source_sheet: sheet, entity_type: 'supplier_product', entity_code: row.supplier_name }
        )
        skipped++
      } else {
        inserted++
      }
    }
  }

  logger.info(
    `Supplier Packaging: ${inserted} inserted, ${updated} updated, ${skipped} skipped, ${errors.length} errors`,
    { source_sheet: sheet }
  )
  return { inserted, updated, skipped, errors: errors.length }
}
