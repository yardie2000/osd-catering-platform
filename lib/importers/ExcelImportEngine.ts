import * as XLSX from 'xlsx'
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database, ImportOptions, ImportResult } from '@/types'
import { ImportLogger } from './ImportLogger'
import { importUnits } from './UnitImporter'
import { importIngredients } from './IngredientImporter'
import { importSuppliers } from './SupplierImporter'
import { importRecipes, importRecipeIngredients } from './RecipeImporter'
import { importMenus } from './MenuImporter'
import { importPositions, importMenuPositions, importPositionComponents } from './PositionImporter'

// Sheet name aliases — case-insensitive, spaces/dashes → underscores
const SHEET_MAP = {
  units:               ['units', 'einheiten', 'unit'],
  ingredients:         ['ingredients', 'zutaten', 'ingredient'],
  suppliers:           ['suppliers', 'lieferanten', 'supplier'],
  recipes:             ['recipes', 'rezepte', 'recipe'],
  recipe_ingredients:  ['recipe_ingredients', 'rezept_zutaten', 'recipe_zutaten'],
  menus:               ['menus', 'menüs', 'menu'],
  positions:           ['positions', 'positionen', 'position'],
  menu_positions:      ['menu_positions', 'menü_positions', 'menu_position', 'menu_positionen'],
  position_components: ['position_components', 'positions_komponenten', 'position_komponenten'],
} as const

function findSheet(workbook: XLSX.WorkBook, aliases: readonly string[]): XLSX.WorkSheet | null {
  for (const alias of aliases) {
    const name = workbook.SheetNames.find(
      (n) => n.toLowerCase().replace(/[\s-]+/g, '_') === alias
    )
    if (name) return workbook.Sheets[name]
  }
  return null
}

// range:2 — skips title row + blank row (legacy sheets: units/ingredients/recipes/recipe_ingredients/suppliers)
// range:0 — headers at row 0 (V4 sheets: menus/menu_items)
function sheetToRows(sheet: XLSX.WorkSheet | null, range = 2): unknown[] {
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { defval: null, range })
}

export class ExcelImportEngine {
  private client: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.client = client
  }

  async run(buffer: ArrayBuffer, options: Omit<ImportOptions, 'file'>): Promise<ImportResult> {
    const start = Date.now()
    const workbook = XLSX.read(buffer, { type: 'array' })

    const { data: job, error: jobError } = await this.client
      .from('import_jobs')
      .insert({
        filename:    options.filename,
        status:      options.dryRun ? 'dry_run' : 'running',
        dry_run:     options.dryRun,
        total_rows:  0,
        inserted:    0,
        updated:     0,
        skipped:     0,
        errors:      0,
        finished_at: null,
        created_by:  options.createdBy ?? null,
      })
      .select()
      .single()

    if (jobError || !job) {
      throw new Error(`Failed to create import job: ${jobError?.message}`)
    }

    const logger = new ImportLogger(job.id)

    try {
      logger.info(`Import V5.2 started: ${options.filename}${options.dryRun ? ' (DRY RUN)' : ''}`)

      // Parse all sheets
      const unitRows             = sheetToRows(findSheet(workbook, SHEET_MAP.units))
      const ingredientRows       = sheetToRows(findSheet(workbook, SHEET_MAP.ingredients))
      const supplierRows         = sheetToRows(findSheet(workbook, SHEET_MAP.suppliers))
      const recipeRows           = sheetToRows(findSheet(workbook, SHEET_MAP.recipes))
      const recipeIngredientRows = sheetToRows(findSheet(workbook, SHEET_MAP.recipe_ingredients))
      const menuRows             = sheetToRows(findSheet(workbook, SHEET_MAP.menus), 0)
      const positionRows         = sheetToRows(findSheet(workbook, SHEET_MAP.positions), 0)
      const menuPositionRows     = sheetToRows(findSheet(workbook, SHEET_MAP.menu_positions), 0)
      const positionComponentRows = sheetToRows(findSheet(workbook, SHEET_MAP.position_components), 0)

      logger.info(
        `Rows found — units:${unitRows.length} ingredients:${ingredientRows.length} ` +
        `suppliers:${supplierRows.length} recipes:${recipeRows.length} ` +
        `recipe_ingredients:${recipeIngredientRows.length} menus:${menuRows.length} ` +
        `positions:${positionRows.length} menu_positions:${menuPositionRows.length} ` +
        `position_components:${positionComponentRows.length}`
      )

      // ── Import in dependency order ─────────────────────────
      // 1. Units
      const unitResult = await importUnits(this.client, unitRows, logger, options.dryRun)

      // 2. Ingredients
      const ingredientResult = await importIngredients(
        this.client, ingredientRows, logger, options.dryRun
      )

      // 3. Supplier Packaging (depends on ingredientIdMap)
      const supplierResult = supplierRows.length > 0
        ? await importSuppliers(
            this.client, supplierRows, logger, options.dryRun,
            ingredientResult.ingredientIdMap
          )
        : { inserted: 0, updated: 0, skipped: 0, errors: 0 }

      // 4. Recipes
      const recipeResult = await importRecipes(this.client, recipeRows, logger, options.dryRun)

      // 5. Recipe Ingredients (depends on recipe/ingredient/unit maps)
      const riResult = await importRecipeIngredients(
        this.client, recipeIngredientRows, logger, options.dryRun,
        recipeResult.recipeIdMap,
        ingredientResult.ingredientIdMap,
        unitResult.unitIdMap
      )

      // 6. Menus
      const menuResult = menuRows.length > 0
        ? await importMenus(this.client, menuRows, logger, options.dryRun)
        : { inserted: 0, updated: 0, skipped: 0, errors: 0, menuMap: new Map<string, string>() }

      // 7. Positions (V5 geteilter Katalog) — by position_code
      const positionResult = positionRows.length > 0
        ? await importPositions(this.client, positionRows, logger, options.dryRun)
        : { inserted: 0, updated: 0, skipped: 0, errors: 0, positionCodeMap: new Map<string, string>() }

      // 8. Menu Positions (depends on menuMap + positionCodeMap)
      const menuPositionResult = menuPositionRows.length > 0
        ? await importMenuPositions(
            this.client, menuPositionRows, logger, options.dryRun,
            menuResult.menuMap, positionResult.positionCodeMap
          )
        : { inserted: 0, updated: 0, skipped: 0, errors: 0 }

      // 9. Position Components (depends on positionCodeMap + recipeCodeMap; resolves ingredients/units via DB)
      const positionComponentResult = positionComponentRows.length > 0
        ? await importPositionComponents(
            this.client, positionComponentRows, logger, options.dryRun,
            positionResult.positionCodeMap, recipeResult.recipeCodeMap
          )
        : { inserted: 0, skipped: 0, errors: 0 }

      // ── Aggregate counts ───────────────────────────────────
      const totalInserted =
        unitResult.inserted + ingredientResult.inserted + supplierResult.inserted +
        recipeResult.inserted + riResult.inserted + menuResult.inserted +
        positionResult.inserted + menuPositionResult.inserted + positionComponentResult.inserted

      const totalUpdated =
        unitResult.updated + ingredientResult.updated + supplierResult.updated +
        recipeResult.updated + menuResult.updated +
        positionResult.updated + menuPositionResult.updated

      const totalSkipped =
        unitResult.skipped + ingredientResult.skipped + supplierResult.skipped +
        recipeResult.skipped + riResult.skipped + menuResult.skipped +
        positionResult.skipped + menuPositionResult.skipped + positionComponentResult.skipped

      const totalErrors =
        unitResult.errors + ingredientResult.errors + supplierResult.errors +
        recipeResult.errors + riResult.errors + menuResult.errors +
        positionResult.errors + menuPositionResult.errors + positionComponentResult.errors

      const totalRows =
        unitRows.length + ingredientRows.length + supplierRows.length +
        recipeRows.length + recipeIngredientRows.length + menuRows.length +
        positionRows.length + menuPositionRows.length + positionComponentRows.length

      const warnings = logger.getLogs().filter((l) => l.severity === 'warning').length

      // ── Import Summary ─────────────────────────────────────
      logger.info(
        [
          '─────────────────────────────────',
          'IMPORT SUMMARY',
          `Units imported:             ${unitResult.inserted + unitResult.updated}`,
          `Ingredients imported:       ${ingredientResult.inserted + ingredientResult.updated}`,
          `Suppliers imported:         ${supplierResult.inserted + supplierResult.updated}`,
          `Supplier Packaging imported:${supplierResult.inserted + supplierResult.updated}`,
          `Recipes imported:           ${recipeResult.inserted + recipeResult.updated}`,
          `Recipe Ingredients imported:${riResult.inserted}`,
          `Menus imported:             ${menuResult.inserted + menuResult.updated}`,
          `Positions imported:         ${positionResult.inserted + positionResult.updated}`,
          `Menu Positions imported:    ${menuPositionResult.inserted}`,
          `Position Components imported:${positionComponentResult.inserted}`,
          `Created records:            ${totalInserted}`,
          `Updated records:            ${totalUpdated}`,
          `Warnings:                   ${warnings}`,
          `Errors:                     ${totalErrors}`,
          `Duration:                   ${Date.now() - start}ms`,
          '─────────────────────────────────',
        ].join('\n')
      )

      const logs = logger.getLogs()
      if (logs.length > 0) {
        await this.client.from('data_import_log').insert(logs)
      }

      await this.client.from('import_jobs').update({
        status:      options.dryRun ? 'dry_run' : 'completed',
        total_rows:  totalRows,
        inserted:    totalInserted,
        updated:     totalUpdated,
        skipped:     totalSkipped,
        errors:      totalErrors,
        finished_at: new Date().toISOString(),
      }).eq('id', job.id)

      return {
        jobId:          job.id,
        status:         options.dryRun ? 'dry_run' : 'completed',
        dryRun:         options.dryRun,
        previews:       [],
        totalInserted,
        totalUpdated,
        totalSkipped,
        totalErrors,
        duration:       Date.now() - start,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      logger.error(`Import failed: ${message}`)

      await this.client.from('import_jobs').update({
        status:      'failed',
        finished_at: new Date().toISOString(),
      }).eq('id', job.id)

      const logs = logger.getLogs()
      if (logs.length > 0) {
        await this.client.from('data_import_log').insert(logs)
      }

      return {
        jobId:          job.id,
        status:         'failed',
        dryRun:         options.dryRun,
        previews:       [],
        totalInserted:  0,
        totalUpdated:   0,
        totalSkipped:   0,
        totalErrors:    1,
        duration:       Date.now() - start,
      }
    }
  }
}
