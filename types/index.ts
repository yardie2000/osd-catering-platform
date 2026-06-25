export * from './database'

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FilterParams {
  search?: string
  category?: string
  active?: boolean
}

export interface SortParams {
  column: string
  direction: 'asc' | 'desc'
}

export type ImportEntityType =
  | 'units'
  | 'ingredients'
  | 'suppliers'
  | 'recipes'
  | 'recipe_ingredients'
  | 'menus'
  | 'menu_items'
  | 'supplier_products'

export interface ImportOptions {
  dryRun: boolean
  file: File | Buffer
  filename: string
  createdBy?: string
}

export interface ValidationError {
  row: number
  sheet: string
  field: string
  value: unknown
  message: string
}

export interface ImportPreview {
  entityType: ImportEntityType
  sheet: string
  totalRows: number
  validRows: number
  invalidRows: number
  newRows: number
  updateRows: number
  skipRows: number
  errors: ValidationError[]
  warnings: ValidationError[]
}

export interface ImportResult {
  jobId: string
  status: 'completed' | 'failed' | 'dry_run'
  dryRun: boolean
  previews: ImportPreview[]
  totalInserted: number
  totalUpdated: number
  totalSkipped: number
  totalErrors: number
  duration: number
}

export const ALLERGENS = [
  'Gluten',
  'Krebstiere',
  'Eier',
  'Fisch',
  'Erdnüsse',
  'Soja',
  'Milch',
  'Schalenfrüchte',
  'Sellerie',
  'Senf',
  'Sesam',
  'Sulfite',
  'Lupinen',
  'Weichtiere',
] as const

export type Allergen = (typeof ALLERGENS)[number]

export const INGREDIENT_CATEGORIES = [
  'Fleisch & Geflügel',
  'Fisch & Meeresfrüchte',
  'Gemüse',
  'Obst',
  'Milchprodukte',
  'Eier',
  'Getreide & Mehl',
  'Gewürze & Kräuter',
  'Öle & Fette',
  'Saucen & Dips',
  'Trockenprodukte',
  'Getränke',
  'Backwaren',
  'Sonstiges',
] as const

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number]

export const MENU_CATEGORIES = [
  'Frühstück',
  'Mittagessen',
  'Abendessen',
  'Buffet',
  'Fingerfood',
  'Dessert',
  'Getränke',
  'Sonstiges',
] as const

export type MenuCategory = (typeof MENU_CATEGORIES)[number]

export const MENU_ITEM_TYPES = [
  'gericht',
  'komponente',
  'addon',
  'service',
  'sonstiges',
] as const

export type MenuItemTypeOption = (typeof MENU_ITEM_TYPES)[number]

export const MENU_ITEM_TYPE_LABELS: Record<MenuItemTypeOption, string> = {
  gericht: 'Gericht',
  komponente: 'Komponente',
  addon: 'Zusatzleistung',
  service: 'Service',
  sonstiges: 'Sonstiges',
}

export const MATCH_STATUS_VALUES = [
  'unmatched',
  'matched',
  'manuell_bestaetigt',
  'ignoriert',
] as const

export type MatchStatusOption = (typeof MATCH_STATUS_VALUES)[number]

export const MATCH_STATUS_LABELS: Record<MatchStatusOption, string> = {
  unmatched: 'Nicht zugeordnet',
  matched: 'Zugeordnet',
  manuell_bestaetigt: 'Manuell bestätigt',
  ignoriert: 'Ignoriert',
}

// V5.1 — kanonische Pflichtfelder der Rezeptbasis (snake_case, an Recipe-Typ ausgerichtet).
export const REZEPT_PFLICHTFELDER = [
  'name',
  'base_portions',
  'yield_quantity',
  'yield_unit_id',
  'yield_pct',
  'production_loss_pct',
] as const

export type RezeptPflichtfeld = (typeof REZEPT_PFLICHTFELDER)[number]

export const IMPORT_MATCH_CONFIDENCE_MIN = 0
export const IMPORT_MATCH_CONFIDENCE_MAX = 100

export const KITCHEN_BATCH_STATUS = [
  'planned',
  'in_progress',
  'completed',
  'cancelled',
] as const

export type KitchenBatchStatusOption = (typeof KITCHEN_BATCH_STATUS)[number]

export const KITCHEN_BATCH_STATUS_LABELS: Record<KitchenBatchStatusOption, string> = {
  planned: 'Geplant',
  in_progress: 'In Bearbeitung',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
}
