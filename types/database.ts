// ── Auto-maintained TypeScript types for Supabase schema V5.1 ──

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
      positions: {
        Row:           Position
        Insert:        PositionInsert
        Update:        PositionUpdate
        Relationships: []
      }
      menu_positions: {
        Row:           MenuPosition
        Insert:        MenuPositionInsert
        Update:        MenuPositionUpdate
        Relationships: [
          { foreignKeyName: 'menu_positions_menu_id_fkey';     columns: ['menu_id'];     referencedRelation: 'menus';     referencedColumns: ['id'] },
          { foreignKeyName: 'menu_positions_position_id_fkey';  columns: ['position_id'];  referencedRelation: 'positions';  referencedColumns: ['id'] }
        ]
      }
      position_components: {
        Row:           PositionComponent
        Insert:        PositionComponentInsert
        Update:        PositionComponentUpdate
        Relationships: [
          { foreignKeyName: 'position_components_position_id_fkey';   columns: ['position_id'];   referencedRelation: 'positions';   referencedColumns: ['id'] },
          { foreignKeyName: 'position_components_recipe_id_fkey';     columns: ['recipe_id'];     referencedRelation: 'recipes';     referencedColumns: ['id'] },
          { foreignKeyName: 'position_components_ingredient_id_fkey'; columns: ['ingredient_id']; referencedRelation: 'ingredients'; referencedColumns: ['id'] },
          { foreignKeyName: 'position_components_unit_id_fkey';       columns: ['unit_id'];       referencedRelation: 'units';       referencedColumns: ['id'] }
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
      suppliers: {
        Row:           Supplier
        Insert:        SupplierInsert
        Update:        SupplierUpdate
        Relationships: []
      }
      supplier_articles: {
        Row:           SupplierArticle
        Insert:        SupplierArticleInsert
        Update:        SupplierArticleUpdate
        Relationships: [
          { foreignKeyName: 'supplier_articles_supplier_id_fkey'; columns: ['supplier_id']; referencedRelation: 'suppliers'; referencedColumns: ['id'] }
        ]
      }
      ingredient_supplier_articles: {
        Row:           IngredientSupplierArticle
        Insert:        IngredientSupplierArticleInsert
        Update:        IngredientSupplierArticleUpdate
        Relationships: [
          { foreignKeyName: 'ingredient_supplier_articles_ingredient_id_fkey';       columns: ['ingredient_id'];       referencedRelation: 'ingredients';       referencedColumns: ['id'] },
          { foreignKeyName: 'ingredient_supplier_articles_supplier_article_id_fkey'; columns: ['supplier_article_id']; referencedRelation: 'supplier_articles'; referencedColumns: ['id'] }
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
  base_portions:       number | null   // V5.1 Basisportionen; App erzwingt Pflicht, DB bleibt nullable
  yield_quantity:      number | null
  yield_unit_id:       string | null
  preparation:         string | null
  usage_notes:         string | null
  production_notes:    string | null
  shelf_life:          string | null
  scalable:            boolean
  production_loss_pct: number | null   // V5.1 per-recipe override; null -> global default
  yield_pct:           number | null   // V5.1 per-recipe override; null -> global default
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

// ── positions (geteilter Katalog, V5) ─────────────────────────
export type Position = {
  id:            string
  position_code: string | null
  name:          string
  description:   string | null
  dietary:       string | null
  allergens:     string[]
  default_price: number | null
  notes:         string | null
  created_at:    string
  updated_at:    string
}
export type PositionInsert = {
  position_code?: string | null
  name:           string
  description?:   string | null
  dietary?:       string | null
  allergens?:     string[]
  default_price?: number | null
  notes?:         string | null
}
export type PositionUpdate = Partial<PositionInsert>

export type MenuPosition = {
  id:             string
  menu_id:        string
  position_id:    string
  sort_order:     number
  price_override: number | null
  created_at:     string
}
export type MenuPositionInsert = {
  menu_id:        string
  position_id:    string
  sort_order?:    number
  price_override?: number | null
}
export type MenuPositionUpdate = Partial<Omit<MenuPositionInsert, 'menu_id' | 'position_id'>>

export type PositionComponent = {
  id:            string
  position_id:   string
  recipe_id:     string | null
  ingredient_id: string | null
  quantity:      number
  unit_id:       string | null
  sort_order:    number
}
export type PositionComponentInsert = {
  position_id:    string
  recipe_id?:     string | null
  ingredient_id?: string | null
  quantity:       number
  unit_id?:       string | null
  sort_order?:    number
}
export type PositionComponentUpdate = Partial<Omit<PositionComponentInsert, 'position_id'>>

export type PositionComponentWithRefs = PositionComponent & {
  recipe:     { id: string; recipe_code: string; name: string } | null
  ingredient: { id: string; ingredient_code: string; name: string } | null
  unit:       { id: string; unit_code: string; name: string; short_name: string | null } | null
}

export type PositionWithComponents = Position & {
  components: PositionComponentWithRefs[]
}

export type MenuPositionWithPosition = MenuPosition & {
  position: Position | null
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
  id:              string
  supplier_code:   string
  name:            string
  contact_name:    string | null
  email:           string | null
  phone:           string | null
  notes:           string | null
  active:          boolean
  customer_number: string | null
  created_at:      string
  updated_at:      string
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

// ── supplier_articles / EK-Mapping (V5.1) ─────────────────────
// (Supplier-Row-Typ ist oben definiert; hier nur Insert/Update + Artikel.)

export type SupplierInsert =
  Pick<Supplier, 'supplier_code' | 'name'> &
  Partial<Omit<Supplier, 'id' | 'supplier_code' | 'name' | 'created_at' | 'updated_at'>>
export type SupplierUpdate = Partial<SupplierInsert>

export type SupplierArticle = {
  id:                      string
  supplier_id:             string
  supplier_article_number: string | null
  ean_gtin:                string | null
  raw_article_name:        string | null
  clean_article_name_de:   string | null
  ingredient_name_de:      string | null
  category_de:             string | null
  product_type_de:         string | null
  is_food:                 boolean
  is_frozen:               boolean
  is_fresh:                boolean
  is_bio:                  boolean
  origin_country:          string | null
  tax_rate_percent:        number | null
  packaging_unit:          string | null
  packaging_quantity:      number | null
  content_quantity:        number | null
  content_unit:            string | null
  base_unit:               string | null
  base_quantity_total:     number | null
  ek_single_price_net:     number | null
  ek_price_unit:           string | null
  ek_total_price_net:      number | null
  ek_price_per_base_unit:  number | null
  currency:                string
  last_invoice_number:     string | null
  last_invoice_date:       string | null
  last_source_file:        string | null
  match_key:               string | null
  duplicate_group_key:     string | null
  is_active:               boolean
  created_at:              string
  updated_at:              string
}
export type SupplierArticleInsert =
  Pick<SupplierArticle, 'supplier_id'> &
  Partial<Omit<SupplierArticle, 'id' | 'supplier_id' | 'created_at' | 'updated_at'>>
export type SupplierArticleUpdate = Partial<SupplierArticleInsert>

export type IngredientSupplierArticle = {
  id:                                   string
  ingredient_id:                        string
  supplier_article_id:                  string
  match_type:                           string
  match_score:                          number
  is_preferred:                         boolean
  priority:                             number
  conversion_factor_to_ingredient_unit: number | null
  ek_price_override:                    number | null
  notes:                                string | null
  needs_review:                         boolean
  review_reason:                        string | null
  created_at:                           string
  updated_at:                           string
}
export type IngredientSupplierArticleInsert =
  Pick<IngredientSupplierArticle, 'ingredient_id' | 'supplier_article_id'> &
  Partial<Omit<IngredientSupplierArticle, 'id' | 'ingredient_id' | 'supplier_article_id' | 'created_at' | 'updated_at'>>
export type IngredientSupplierArticleUpdate = Partial<IngredientSupplierArticleInsert>

// Join-Formen für die Zutaten-Detailseite (EK-Abschnitt)
export type SupplierArticleWithSupplier = SupplierArticle & {
  supplier: Pick<Supplier, 'id' | 'name'> | null
}
export type IngredientSupplierArticleJoined = IngredientSupplierArticle & {
  supplier_article: SupplierArticleWithSupplier | null
}
