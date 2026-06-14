// ── Auto-maintained TypeScript types for Supabase schema V4 ──

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// Must be `type` (not `interface`) so TypeScript resolves the extends-GenericSchema
// conditional in createClient<Database> correctly and avoids `never` type errors.
export type Database = {
  public: {
    Tables: {
      units: {
        Row:           Unit
        Insert:        UnitInsert
        Update:        UnitUpdate
        Relationships: []
      }
      ingredients: {
        Row:           Ingredient
        Insert:        IngredientInsert
        Update:        IngredientUpdate
        Relationships: [
          { foreignKeyName: 'ingredients_default_unit_id_fkey'; columns: ['default_unit_id']; referencedRelation: 'units'; referencedColumns: ['id'] }
        ]
      }
      recipes: {
        Row:           Recipe
        Insert:        RecipeInsert
        Update:        RecipeUpdate
        Relationships: [
          { foreignKeyName: 'recipes_yield_unit_id_fkey'; columns: ['yield_unit_id']; referencedRelation: 'units'; referencedColumns: ['id'] }
        ]
      }
      recipe_ingredients: {
        Row:           RecipeIngredient
        Insert:        RecipeIngredientInsert
        Update:        RecipeIngredientUpdate
        Relationships: [
          { foreignKeyName: 'recipe_ingredients_recipe_id_fkey';     columns: ['recipe_id'];     referencedRelation: 'recipes';     referencedColumns: ['id'] },
          { foreignKeyName: 'recipe_ingredients_ingredient_id_fkey'; columns: ['ingredient_id']; referencedRelation: 'ingredients'; referencedColumns: ['id'] },
          { foreignKeyName: 'recipe_ingredients_unit_id_fkey';       columns: ['unit_id'];       referencedRelation: 'units';       referencedColumns: ['id'] }
        ]
      }
      menus: {
        Row:           Menu
        Insert:        MenuInsert
        Update:        MenuUpdate
        Relationships: []
      }
      menu_items: {
        Row:           MenuItem
        Insert:        MenuItemInsert
        Update:        MenuItemUpdate
        Relationships: [
          { foreignKeyName: 'menu_items_menu_id_fkey';   columns: ['menu_id'];   referencedRelation: 'menus';   referencedColumns: ['id'] },
          { foreignKeyName: 'menu_items_recipe_id_fkey'; columns: ['recipe_id']; referencedRelation: 'recipes'; referencedColumns: ['id'] }
        ]
      }
      supplier_products: {
        Row:           SupplierProduct
        Insert:        SupplierProductInsert
        Update:        SupplierProductUpdate
        Relationships: [
          { foreignKeyName: 'supplier_products_ingredient_id_fkey'; columns: ['ingredient_id']; referencedRelation: 'ingredients'; referencedColumns: ['id'] }
        ]
      }
      import_jobs: {
        Row:           ImportJob
        Insert:        ImportJobInsert
        Update:        ImportJobUpdate
        Relationships: []
      }
      data_import_log: {
        Row:           DataImportLog
        Insert:        DataImportLogInsert
        Update:        DataImportLogUpdate
        Relationships: [
          { foreignKeyName: 'data_import_log_import_job_id_fkey'; columns: ['import_job_id']; referencedRelation: 'import_jobs'; referencedColumns: ['id'] }
        ]
      }
      purchasing_lists: {
        Row:           PurchasingList
        Insert:        PurchasingListInsert
        Update:        PurchasingListUpdate
        Relationships: [
          { foreignKeyName: 'purchasing_lists_event_id_fkey'; columns: ['event_id']; referencedRelation: 'events'; referencedColumns: ['id'] }
        ]
      }
      purchasing_list_items: {
        Row:           PurchasingListItem
        Insert:        PurchasingListItemInsert
        Update:        PurchasingListItemUpdate
        Relationships: [
          { foreignKeyName: 'purchasing_list_items_purchasing_list_id_fkey'; columns: ['purchasing_list_id']; referencedRelation: 'purchasing_lists'; referencedColumns: ['id'] },
          { foreignKeyName: 'purchasing_list_items_ingredient_id_fkey';      columns: ['ingredient_id'];      referencedRelation: 'ingredients';       referencedColumns: ['id'] },
          { foreignKeyName: 'purchasing_list_items_unit_id_fkey';            columns: ['unit_id'];            referencedRelation: 'units';             referencedColumns: ['id'] }
        ]
      }
      production_batches: {
        Row:           ProductionBatch
        Insert:        ProductionBatchInsert
        Update:        ProductionBatchUpdate
        Relationships: [
          { foreignKeyName: 'production_batches_recipe_id_fkey'; columns: ['recipe_id']; referencedRelation: 'recipes'; referencedColumns: ['id'] },
          { foreignKeyName: 'production_batches_unit_id_fkey';   columns: ['unit_id'];   referencedRelation: 'units';   referencedColumns: ['id'] }
        ]
      }
      kitchen_batches: {
        Row:           KitchenBatch
        Insert:        KitchenBatchInsert
        Update:        KitchenBatchUpdate
        Relationships: []
      }
      kitchen_batch_items: {
        Row:           KitchenBatchItem
        Insert:        KitchenBatchItemInsert
        Update:        KitchenBatchItemUpdate
        Relationships: [
          { foreignKeyName: 'kitchen_batch_items_batch_id_fkey'; columns: ['batch_id']; referencedRelation: 'kitchen_batches'; referencedColumns: ['id'] },
          { foreignKeyName: 'kitchen_batch_items_menu_id_fkey';  columns: ['menu_id'];  referencedRelation: 'menus';           referencedColumns: ['id'] }
        ]
      }
    }
    Views:     { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums:     { [_ in never]: never }
  }
}

// ── units ──────────────────────────────────────────────────

// Row types must be declared as `type` (not `interface`) so TypeScript's structural
// checker considers them compatible with Record<string, unknown> — required by GenericTable.

export type Unit = {
  id:                string
  unit_code:         string
  name:              string
  short_name:        string | null
  base_unit:         string | null
  conversion_factor: number | null
  created_at:        string
  updated_at:        string
}

export type UnitInsert = Omit<Unit, 'id' | 'created_at' | 'updated_at'>
export type UnitUpdate = Partial<UnitInsert>

// ── ingredients ───────────────────────────────────────────

export type Ingredient = {
  id:              string
  ingredient_code: string
  name:            string
  category:        string | null
  default_unit_id: string | null
  supplier_name:   string | null
  allergens:       string[]
  notes:           string | null
  created_at:      string
  updated_at:      string
}

export type IngredientInsert = Omit<Ingredient, 'id' | 'created_at' | 'updated_at'>
export type IngredientUpdate = Partial<IngredientInsert>

export type IngredientWithUnit = Ingredient & {
  default_unit: Unit | null
}

// ── recipes ───────────────────────────────────────────────

export type Recipe = {
  id:                  string
  recipe_code:         string
  name:                string
  description:         string | null
  base_portions:       number | null   // ⭐ V4.5 — Basisportionen; App erzwingt Pflicht, DB bleibt nullable
  yield_quantity:      number | null
  yield_unit_id:       string | null
  preparation:         string | null
  usage_notes:         string | null
  production_notes:    string | null
  shelf_life:          string | null
  scalable:            boolean
  production_loss_pct: number | null   // ⭐ V4.2 — per-recipe override; null → global default
  yield_pct:           number | null   // ⭐ V4.2 — per-recipe override; null → global default
  created_at:          string
  updated_at:          string
}

export type RecipeInsert = Omit<Recipe, 'id' | 'created_at' | 'updated_at' | 'base_portions' | 'production_loss_pct' | 'yield_pct'> & {
  base_portions?:       number | null
  production_loss_pct?: number | null
  yield_pct?:           number | null
}
export type RecipeUpdate = Partial<RecipeInsert>

export type RecipeWithDetails = Recipe & {
  yield_unit:          Unit | null
  recipe_ingredients:  RecipeIngredientWithDetails[]
}

// ── recipe_ingredients ────────────────────────────────────

export type RecipeIngredient = {
  id:           string
  recipe_id:    string
  ingredient_id:string
  quantity:     number
  unit_id:      string
  supplier:     string | null
  notes:        string | null
  package_qty:  number | null
  package_unit: string | null
  created_at:   string
}

export type RecipeIngredientInsert = Omit<RecipeIngredient, 'id' | 'created_at'>
export type RecipeIngredientUpdate = Partial<RecipeIngredientInsert>

export type RecipeIngredientWithDetails = RecipeIngredient & {
  ingredient: Ingredient
  unit:       Unit
}

// ── menus ─────────────────────────────────────────────────
// V3: menu_name, menu_description, category (aligned with DB column names)

export type Menu = {
  id:              string
  menu_code:       string
  menu_name:       string
  menu_description:string | null
  category:        string | null
  price_per_person:number | null
  active:          boolean
  created_at:      string
  updated_at:      string
}

export type MenuInsert = Omit<Menu, 'id' | 'created_at' | 'updated_at'>
export type MenuUpdate = Partial<MenuInsert>

export type MenuWithItems = Menu & {
  menu_items: MenuItemWithDetails[]
}

// ── menu_items ────────────────────────────────────────────
// V4 (live schema): each row is a standalone menu line that
// carries its own name, description, dietary flag, allergens and
// price, AND an OPTIONAL recipe_id linking it to a recipe.
// recipe_id is nullable: a line may be backed by a recipe (used
// for production scaling / purchasing) or stay standalone.

export type MenuItem = {
  id:          string
  menu_id:     string
  recipe_id:   string | null
  name:        string
  description: string | null
  dietary:     string | null
  item_price:  number | null
  allergens:   string[]
  sort_order:  number
}

export type MenuItemInsert = Omit<MenuItem, 'id' | 'allergens' | 'recipe_id'> & {
  allergens?: string[]
  recipe_id?: string | null
}
export type MenuItemUpdate = Partial<MenuItemInsert>

// menu line with its (optional) joined recipe — used by menu detail
export type MenuItemWithDetails = MenuItem & {
  recipe: Recipe | null
}

// ── supplier_products ─────────────────────────────────────

export type SupplierProduct = {
  id:                      string
  ingredient_id:           string
  supplier_name:           string
  supplier_article_number: string | null
  package_quantity:        number | null
  package_unit:            string | null
  package_description:     string | null
  minimum_order_quantity:  number | null
  lead_time_days:          number | null
  supplier_sku:            string | null
  supplier_pack_price:     number | null
  active:                  boolean
  created_at:              string
  updated_at:              string
}

export type SupplierProductInsert = Omit<SupplierProduct, 'id' | 'created_at' | 'updated_at'>
export type SupplierProductUpdate = Partial<SupplierProductInsert>

// ── import_jobs ───────────────────────────────────────────

export type ImportJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'dry_run'

export type ImportJob = {
  id:          string
  filename:    string
  status:      ImportJobStatus
  dry_run:     boolean
  total_rows:  number
  inserted:    number
  updated:     number
  skipped:     number
  errors:      number
  started_at:  string
  finished_at: string | null
  created_by:  string | null
}

export type ImportJobInsert = Omit<ImportJob, 'id' | 'started_at'> & { started_at?: string }
export type ImportJobUpdate = Partial<Omit<ImportJob, 'id'>>

// ── data_import_log ───────────────────────────────────────

export type ImportLogSeverity = 'info' | 'warning' | 'error'

export type DataImportLog = {
  id:            string
  import_job_id: string
  severity:      ImportLogSeverity
  message:       string
  row_number:    number | null
  source_sheet:  string | null
  entity_type:   string | null
  entity_code:   string | null
  created_at:    string
}

export type DataImportLogInsert = Omit<DataImportLog, 'id' | 'created_at'>
export type DataImportLogUpdate = Partial<DataImportLogInsert>

// ── future module stubs ───────────────────────────────────

export type Event = {
  id:          string
  event_code:  string
  name:        string
  event_date:  string | null
  guest_count: number | null
  status:      string
  notes:       string | null
  created_at:  string
  updated_at:  string
}

export type Supplier = {
  id:           string
  supplier_code:string
  name:         string
  contact_name: string | null
  email:        string | null
  phone:        string | null
  notes:        string | null
  active:       boolean
  created_at:   string
  updated_at:   string
}

// ── purchasing (V4: persistence active) ───────────────────

export type PurchasingList = {
  id:         string
  event_id:   string | null
  name:       string
  status:     string
  created_at: string
  updated_at: string
}

export type PurchasingListInsert = {
  event_id?: string | null
  name:      string
  status?:   string
}
export type PurchasingListUpdate = Partial<PurchasingListInsert>

export type PurchasingListItem = {
  id:                 string
  purchasing_list_id: string
  ingredient_id:      string
  quantity_needed:    number
  unit_id:            string
  supplier_id:        string | null
  unit_price:         number | null
  notes:              string | null
}

export type PurchasingListItemInsert = Omit<PurchasingListItem, 'id'>
export type PurchasingListItemUpdate = Partial<PurchasingListItemInsert>

// ── production (V4: persistence active) ────────────────────

export type ProductionBatch = {
  id:           string
  event_id:     string | null
  recipe_id:    string
  batch_size:   number
  unit_id:      string
  planned_date: string | null
  status:       string
  station:      string | null
  notes:        string | null
  created_at:   string
}

export type ProductionBatchInsert = {
  event_id?:     string | null
  recipe_id:     string
  batch_size:    number
  unit_id:       string
  planned_date?: string | null
  status?:       string
  station?:      string | null
  notes?:        string | null
}
export type ProductionBatchUpdate = Partial<ProductionBatchInsert>

// ── kitchen_batches (V4.1: single production-planning entity) ──

export type KitchenBatch = {
  id:              string
  name:            string
  description:     string | null
  start_date:      string | null
  end_date:        string | null
  production_date: string | null
  status:          string
  created_at:      string
  updated_at:      string
}

export type KitchenBatchInsert = {
  name:             string
  description?:     string | null
  start_date?:      string | null
  end_date?:        string | null
  production_date?: string | null
  status?:          string
}
export type KitchenBatchUpdate = Partial<KitchenBatchInsert>

export type KitchenBatchItem = {
  id:        string
  batch_id:  string
  menu_id:   string
  pax_count: number
}

export type KitchenBatchItemInsert = Omit<KitchenBatchItem, 'id'>
export type KitchenBatchItemUpdate = Partial<KitchenBatchItemInsert>

// batch item joined with its menu (for the batch detail UI)
export type KitchenBatchItemWithMenu = KitchenBatchItem & {
  menu: { id: string; menu_code: string; menu_name: string } | null
}

export type KitchenBatchWithItems = KitchenBatch & {
  kitchen_batch_items: KitchenBatchItemWithMenu[]
}
