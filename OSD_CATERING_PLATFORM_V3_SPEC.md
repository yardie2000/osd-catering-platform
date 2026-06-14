# OSD Catering Platform — Vollständige Projektspezifikation V3

> ⚠️ **SUPERSEDED / HISTORISCH (Stand 2026-06-06).** Diese V3-Spec ist **nicht mehr maßgeblich**.
> Die aktuelle, autoritative Referenz ist **`OSD_CATERING_PLATFORM_V4_SPEC.md`**.
> Achtung: Teile dieses Dokuments beschreiben ein *intendiertes* Schema, das so nie live war
> (z. B. `menu_items` mit Pflicht-`recipe_id`). Bei jedem Konflikt gilt die V4-Spec bzw. die Live-DB.
> Dieses Dokument bleibt nur als Entwicklungs-Historie erhalten.

**Stand: 2026-06-03 | Basis für V4-Entwicklung | abgelöst durch V4-Spec**

---

## ZWECK DIESER DATEI

Diese Datei ist die **einzige autoritative Referenz** für alle folgenden Entwicklungsversionen.
Sie enthält: Systemzweck, Architektur, Tech-Stack, vollständiges Datenbankschema (V3), alle Dateinamen und deren Funktion, bekannte Constraints, Konventionen und offene Zukunftsmodule.
Sie wird als Prompt-Grundlage für Claude Code verwendet.

---

## 1. SYSTEMZWECK

Das System ist **kein allgemeines Eventmanagement-Tool**.
Es ist ein **operativer Calculation Engine Layer** für Catering-Produktionen.

**Kernfunktionen:**
- Menü-Kalkulation (welche Rezepte sind in einem Menü)
- Mengenskalierung von Rezepten
- Zutaten-Aggregation
- Einkaufslisten-Vorbereitung
- Excel-Import-Engine für Stammdaten

**Ausserhalb des Systems (bewusst nicht integriert):**
- Mausclick (externes Tool)
- CrewBrain (externes Tool)
- Eventbuchung / Gästemanagement (Zukunftsmodul)

**Das System ist ein spezialisierter Middleware-/Operations-Layer.**

---

## 2. PROJEKTPFAD UND TECH STACK

```
Projektpfad:  D:\Downloads\files\catering-platform-v3
Arbeitsverz:  D:\Downloads\files
```

| Technologie | Version | Zweck |
|---|---|---|
| Next.js | 15.0.3 | Framework, App Router |
| React | 19.0.0-rc | UI |
| TypeScript | 5.9.3 | Sprache |
| Supabase JS | 2.106.2 | Datenbankzugang |
| PostgreSQL | via Supabase | Datenbank |
| PostgREST | v12 | REST-Layer |
| TanStack Query | 5.x | Client-State / Caching |
| React Hook Form | 7.x | Formulare |
| Zod | 3.x | Validierung |
| shadcn/ui + Tailwind | — | UI-Komponenten |
| xlsx | 0.18.5 | Excel-Import |
| Lucide React | — | Icons |
| Sonner | 1.x | Toast-Notifications |

---

## 3. VERZEICHNISSTRUKTUR (vollständig)

```
catering-platform-v3/
├── app/
│   ├── (admin)/                        # Alle Admin-Seiten (geschützte Route-Gruppe)
│   │   ├── layout.tsx                  # Admin-Layout (AppLayout-Wrapper)
│   │   ├── master-data/
│   │   │   ├── units/page.tsx          # Einheiten-Verwaltung (CRUD)
│   │   │   ├── ingredients/page.tsx    # Zutaten-Verwaltung (CRUD)
│   │   │   ├── recipes/
│   │   │   │   ├── page.tsx            # Rezept-Liste
│   │   │   │   ├── [id]/page.tsx       # Rezept-Detail (mit Zutaten)
│   │   │   │   └── [id]/edit/page.tsx  # Rezept-Editor
│   │   │   └── menus/
│   │   │       ├── page.tsx            # Menü-Liste (CRUD)
│   │   │       └── [id]/page.tsx       # Menü-Detail (Rezept-Zuordnung)
│   │   ├── operations/
│   │   │   ├── imports/page.tsx        # Import Center (Datei-Upload, History)
│   │   │   ├── validation/page.tsx     # Validierungs-Dashboard
│   │   │   └── data-quality/page.tsx   # Datenqualitäts-Übersicht
│   │   ├── kitchen/
│   │   │   ├── production/page.tsx     # [STUB] Produktionsplanung
│   │   │   └── purchasing/page.tsx     # [STUB] Einkaufsplanung
│   │   └── settings/page.tsx           # Verbindungsstatus, V3-Schema-Info, Zukunftsmodule
│   ├── api/
│   │   └── imports/
│   │       ├── route.ts                # POST /api/imports (Datei-Upload), GET (Job-Liste)
│   │       └── [id]/route.ts           # GET /api/imports/[id] (Job+Logs), DELETE (rollback)
│   ├── globals.css                     # Globale Styles
│   ├── layout.tsx                      # Root Layout (QueryProvider, Toaster)
│   └── page.tsx                        # Landing / Redirect
├── components/
│   ├── layout/
│   │   ├── app-layout.tsx              # Sidebar + Content Wrapper
│   │   ├── page-header.tsx             # Seitenheader mit Titel/Actions
│   │   └── sidebar.tsx                 # Navigation (NavLeaf/NavGroup-Typen)
│   └── ui/                             # shadcn/ui Komponenten
│       ├── badge.tsx                   # Varianten: default/secondary/destructive/outline/success/warning/error
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── table.tsx
│       └── textarea.tsx
├── hooks/
│   ├── use-units.ts                    # useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit
│   ├── use-ingredients.ts              # useIngredients, useIngredientCategories, CRUD-Mutations
│   ├── use-recipes.ts                  # useRecipes, useRecipe, CRUD + scaleRecipe
│   ├── use-menus.ts                    # useMenus, useMenu, useMenuCategories, CRUD + MenuItem-Mutations
│   └── use-imports.ts                  # useImportJobs, useImportJob, useImportLogs
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # Browser-Client: createClient<Database>(URL, ANON_KEY)
│   │   └── server.ts                   # Server-Client: createClient<Database>(URL, SERVICE_ROLE_KEY)
│   ├── importers/
│   │   ├── ExcelImportEngine.ts        # Orchestriert alle Importer, erstellt import_jobs Record
│   │   ├── ImportLogger.ts             # Sammelt DataImportLogInsert-Einträge pro Job
│   │   ├── ValidationEngine.ts         # Zod-Schemas + validateRows(), parseGermanNumber()
│   │   ├── UnitImporter.ts             # Importiert Einheiten (Sheet: units/einheiten)
│   │   ├── IngredientImporter.ts       # Importiert Zutaten (Sheet: ingredients/zutaten)
│   │   ├── SupplierImporter.ts         # Importiert Lieferantenpreise (Sheet: suppliers/lieferanten)
│   │   ├── RecipeImporter.ts           # Importiert Rezepte (Sheet: recipes/rezepte)
│   │   ├── MenuImporter.ts             # Importiert Menüs (Sheet: menus/menüs)
│   │   └── MenuItemImporter.ts         # Importiert Menü-Positionen (Sheet: menu_items/menü_items)
│   └── utils.ts                        # cn() für Tailwind-Klassen
├── providers/
│   └── query-provider.tsx              # TanStack QueryClient Provider
├── services/
│   ├── units.service.ts                # CRUD + search
│   ├── ingredients.service.ts          # CRUD + getCategories + getUsageCount
│   ├── recipes.service.ts              # CRUD + scaleRecipe + getAllergens + upsertIngredients
│   ├── menus.service.ts                # CRUD + upsertItems + addItem + removeItem + getCategories
│   └── imports.service.ts             # getJobs + getJob + createJob + getLogs + getLogsBySeverity
├── supabase/
│   └── migrations/
│       ├── 20260601000001_v2_schema.sql          # Basis-Schema (units, ingredients, recipes, menus, menu_recipes, import, stubs)
│       ├── 20260601000002_v3_additions.sql        # +price_per_person, +service_note auf menus; supplier_products Tabelle
│       ├── 20260601000003_recipe_ingredients_kolli.sql  # +package_qty, +package_unit auf recipe_ingredients
│       └── 20260603000001_v3_menus_items.sql      # AKTIVE V3-MIGRATION: menu_name/menu_description, menu_items, drops
├── types/
│   ├── database.ts                     # MASTER: Database-Typ + alle Entity-Typen (alle als `type`, nicht `interface`!)
│   └── index.ts                        # Re-export + UI-Hilfstypen + Konstanten
├── .env.local                          # Lokale Secrets (nicht ins Git)
├── .env.example                        # ENV-Vorlage
├── tsconfig.json                       # strict: true, incremental: true, paths @/*
├── tailwind.config.ts
├── next.config.ts
└── components.json                     # shadcn/ui Konfiguration
```

---

## 4. DATENBANKSCHEMA V3 (produktiv, vollständig)

### Aktiv-Status der Migrationen

| Migration | Status | Änderungen |
|---|---|---|
| `20260601000001_v2_schema.sql` | ✅ gelaufen | Basis: units, ingredients, recipes, recipe_ingredients, menus (mit `name`+`description`), menu_recipes, import_jobs, data_import_log, Zukunfts-Stubs |
| `20260601000002_v3_additions.sql` | ✅ gelaufen | menus.+price_per_person, menus.+service_note, supplier_products |
| `20260601000003_recipe_ingredients_kolli.sql` | ✅ gelaufen | recipe_ingredients.+package_qty, +package_unit |
| `20260603000001_v3_menus_items.sql` | ✅ gelaufen | menus: name→menu_name, description→menu_description, DROP service_note, DROP menu_type; CREATE menu_items; DROP menu_recipes |

### Finales Datenbankschema (nach allen Migrationen)

```sql
-- AKTIVE TABELLEN

public.units
  id                UUID PK
  unit_code         TEXT UNIQUE NOT NULL
  name              TEXT NOT NULL
  short_name        TEXT
  base_unit         TEXT
  conversion_factor NUMERIC(18,6)
  created_at        TIMESTAMPTZ
  updated_at        TIMESTAMPTZ

public.ingredients
  id               UUID PK
  ingredient_code  TEXT UNIQUE NOT NULL
  name             TEXT NOT NULL
  category         TEXT
  default_unit_id  UUID → units.id (SET NULL)
  supplier_name    TEXT
  allergens        TEXT[] DEFAULT '{}'
  notes            TEXT
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

public.recipes
  id               UUID PK
  recipe_code      TEXT UNIQUE NOT NULL
  name             TEXT NOT NULL
  description      TEXT
  yield_quantity   NUMERIC(12,4)
  yield_unit_id    UUID → units.id (SET NULL)
  preparation      TEXT
  usage_notes      TEXT
  production_notes TEXT
  shelf_life       TEXT
  scalable         BOOLEAN DEFAULT true
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

public.recipe_ingredients
  id            UUID PK
  recipe_id     UUID → recipes.id (CASCADE)
  ingredient_id UUID → ingredients.id (RESTRICT)
  quantity      NUMERIC(12,4) NOT NULL CHECK > 0
  unit_id       UUID → units.id (RESTRICT)
  supplier      TEXT
  notes         TEXT
  package_qty   NUMERIC(12,4)          -- V3: Kolli-Größe
  package_unit  TEXT                    -- V3: Kolli-Einheit
  created_at    TIMESTAMPTZ

public.menus                            -- V3: umbenannte Spalten
  id               UUID PK
  menu_code        TEXT UNIQUE NOT NULL  -- war: menu_code
  menu_name        TEXT NOT NULL         -- war: name
  menu_description TEXT                  -- war: description
  category         TEXT
  price_per_person NUMERIC(10,2)
  active           BOOLEAN DEFAULT true
  -- DROPPED: service_note (war in migration 2)
  -- DROPPED: menu_type (war nur in TypeScript, nie in SQL)
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

public.menu_items                        -- V3: ersetzt menu_recipes
  id         UUID PK
  menu_id    UUID → menus.id (CASCADE)
  recipe_id  UUID → recipes.id (RESTRICT)
  sort_order INTEGER DEFAULT 0
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  UNIQUE (menu_id, recipe_id)
  -- ENTFERNT: portion_count, portion_unit_id (waren in menu_recipes)

public.supplier_products
  id                      UUID PK
  ingredient_id           UUID → ingredients.id (CASCADE)
  supplier_name           TEXT NOT NULL
  supplier_article_number TEXT
  package_quantity        NUMERIC(12,4)
  package_unit            TEXT
  package_description     TEXT
  minimum_order_quantity  NUMERIC(12,4)
  lead_time_days          INTEGER
  supplier_sku            TEXT
  supplier_pack_price     NUMERIC(12,4)
  active                  BOOLEAN DEFAULT true
  created_at              TIMESTAMPTZ
  updated_at              TIMESTAMPTZ
  UNIQUE (ingredient_id, supplier_name)

public.import_jobs
  id          UUID PK
  filename    TEXT NOT NULL
  status      TEXT CHECK IN ('pending','running','completed','failed','rolled_back','dry_run')
  dry_run     BOOLEAN DEFAULT false
  total_rows  INTEGER DEFAULT 0
  inserted    INTEGER DEFAULT 0
  updated     INTEGER DEFAULT 0
  skipped     INTEGER DEFAULT 0
  errors      INTEGER DEFAULT 0
  started_at  TIMESTAMPTZ DEFAULT now()
  finished_at TIMESTAMPTZ
  created_by  TEXT

public.data_import_log
  id            UUID PK
  import_job_id UUID → import_jobs.id (CASCADE)
  severity      TEXT CHECK IN ('info','warning','error')
  message       TEXT NOT NULL
  row_number    INTEGER
  source_sheet  TEXT
  entity_type   TEXT
  entity_code   TEXT
  created_at    TIMESTAMPTZ

-- ZUKUNFTS-STUBS (existieren in DB, kein UI/Logik)
public.events, public.event_menus
public.suppliers
public.purchasing_lists, public.purchasing_list_items
public.production_batches
```

**Row Level Security:** Alle Tabellen haben RLS aktiviert.
- `authenticated`: FULL ACCESS (USING true, WITH CHECK true)
- `anon`: SELECT auf units, ingredients, recipes, recipe_ingredients, menus, menu_items

---

## 5. TYPESCRIPT-TYPEN (types/database.ts)

### Kritische Konvention — NIEMALS BRECHEN

```typescript
// ✅ RICHTIG — als type deklariert
export type Menu = {
  id: string
  menu_name: string
  // ...
}

// ❌ FALSCH — als interface deklariert
export interface Menu {
  // ...
}
```

**Warum:** TypeScript 5.9.3 behandelt `interface`-Typen anders als `type`-Aliases beim `extends Record<string, unknown>`-Check in conditional types. Supabase's `GenericTable` erfordert `Row/Insert/Update extends Record<string, unknown>`. Mit `interface` schlägt die `extends GenericSchema`-Prüfung in `createClient<Database>` fehl → `Schema = never` → alle `.insert()`/`.update()`/`.select()`-Rückgaben werden `never`. **Alle neuen Typen müssen als `type` deklariert werden.**

### Database-Typ-Struktur

```typescript
export type Database = {
  public: {
    Tables: {
      [tableName]: {
        Row:           EntityType         // muss type sein, nicht interface
        Insert:        EntityInsertType
        Update:        EntityUpdateType
        Relationships: [...] | []
      }
    }
    Views:     { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums:     { [_ in never]: never }
  }
}
```

### Alle Entity-Typen (Kurzübersicht)

```typescript
// Stammdaten
type Unit, UnitInsert, UnitUpdate
type Ingredient, IngredientInsert, IngredientUpdate, IngredientWithUnit
type Recipe, RecipeInsert, RecipeUpdate, RecipeWithDetails
type RecipeIngredient, RecipeIngredientInsert, RecipeIngredientUpdate, RecipeIngredientWithDetails

// V3-Menümodell
type Menu, MenuInsert, MenuUpdate, MenuWithItems
type MenuItem, MenuItemInsert, MenuItemUpdate, MenuItemWithDetails

// Lieferanten
type SupplierProduct, SupplierProductInsert, SupplierProductUpdate

// Import
type ImportJobStatus = 'pending'|'running'|'completed'|'failed'|'rolled_back'|'dry_run'
type ImportJob, ImportJobInsert, ImportJobUpdate
type ImportLogSeverity = 'info'|'warning'|'error'
type DataImportLog, DataImportLogInsert, DataImportLogUpdate

// Zukunfts-Stubs (nur TypeScript, kein DB-Mapping im Database-Typ)
type Event, Supplier, PurchasingList, ProductionBatch
```

### Wichtige abgeleitete Typen

```typescript
// "WithDetails" = Joins mit verwandten Tabellen (kein eigener DB-Row-Typ)
type MenuWithItems = Menu & { menu_items: MenuItemWithDetails[] }
type MenuItemWithDetails = MenuItem & { recipe: Recipe }
type RecipeWithDetails = Recipe & { yield_unit: Unit | null; recipe_ingredients: RecipeIngredientWithDetails[] }
type RecipeIngredientWithDetails = RecipeIngredient & { ingredient: Ingredient; unit: Unit }
type IngredientWithUnit = Ingredient & { default_unit: Unit | null }
```

---

## 6. SUPABASE-VERBINDUNG

### ENV-Variablen (Pflicht)

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co   # Browser + Server
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                      # Browser (Row Level Security)
SUPABASE_SERVICE_ROLE_KEY=eyJ...                          # Server only (Import, Health-Check)
```

**Wichtig:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ist ein ALTER, falscher Name — wurde auf `NEXT_PUBLIC_SUPABASE_ANON_KEY` korrigiert.

### Client-Dateien

```typescript
// lib/supabase/client.ts — Browser (Singleton-Export)
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// lib/supabase/server.ts — Server (Factory-Funktion)
export function createServerClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

**Services** verwenden immer `supabase` aus `client.ts`.
**API-Routes und ImportEngine** verwenden `createServerClient()` aus `server.ts`.

---

## 7. IMPORT-ENGINE

### Architektur

```
POST /api/imports (multipart/form-data, file + dryRun)
  └── ExcelImportEngine.run(buffer, options)
        ├── Erstellt import_jobs Record (status: 'running'|'dry_run')
        ├── ImportLogger (sammelt DataImportLogInsert[])
        ├── ValidationEngine.validateRows() pro Sheet
        └── Importer-Chain (in Reihenfolge):
              1. UnitImporter       → liefert unitIdMap (Excel-ID → UUID)
              2. IngredientImporter → liefert ingredientIdMap + ingredientCodeMap
              3. SupplierImporter   → nutzt ingredientIdMap
              4. RecipeImporter     → liefert recipeIdMap + recipeCodeMap
              5. RecipeIngredientImporter (in RecipeImporter) → nutzt ingredientIdMap + unitIdMap
              6. MenuImporter       → liefert menuMap (menu_code → UUID)
              7. MenuItemImporter   → nutzt menuMap + recipeCodeMap
        ├── Persistiert DataImportLog-Einträge (bulk insert)
        └── Aktualisiert import_jobs (status: 'completed'|'failed')
```

### Excel-Sheet-Name-Aliases (case-insensitive)

| Interner Key | Akzeptierte Sheet-Namen |
|---|---|
| `units` | units, einheiten, unit |
| `ingredients` | ingredients, zutaten, ingredient |
| `suppliers` | suppliers, lieferanten, supplier |
| `recipes` | recipes, rezepte, recipe |
| `recipe_ingredients` | recipe_ingredients, rezept_zutaten, recipe_zutaten |
| `menus` | menus, menüs, menu |
| `menu_items` | menu_items, menü_items, menu_positionen |

### Zeilenversatz (sheetToRows range)

- **range: 2** (Zeile 1 = Titel, Zeile 2 = leer, Zeile 3 = Headers): units, ingredients, recipes, recipe_ingredients, suppliers
- **range: 0** (Zeile 1 = Headers direkt): menus, menu_items

### V3-Zod-Schemas (ValidationEngine.ts)

```typescript
// Menus-Sheet (V3)
menuRowSchemaV3: {
  menu_code:        string (required)
  menu_name:        string (required)
  menu_description: string | null (optional)
  category:         string | null (optional)
  price_per_person: number | null (optional, German-Format)
  active:           boolean (optional, default true, akzeptiert: false/0/nein/no)
}

// Menu-Items-Sheet (V3)
menuItemRowSchema: {
  menu_code:   string (required)
  recipe_code: string (required)
  sort_order:  number int (optional, default 0)
}
```

### Dry-Run-Modus

- Alle Validierungen laufen normal
- Keine Writes in die Datenbank
- Logging zeigt "[DRY RUN] Would insert/update"
- import_jobs.status = 'dry_run'

---

## 8. SERVICE-LAYER-KONVENTIONEN

Alle Services unter `services/*.service.ts` folgen diesen Regeln:

```typescript
// Alle nutzen den Browser-Client
import { supabase } from '@/lib/supabase/client'

// Fehlerbehandlung immer: if (error) throw error
// Rückgabe des typisierten Ergebnisses

// Für Joins die "WithDetails"-Typen verwenden
// Type Assertions (as MenuWithItems) nur für verschachtelte Queries nötig
// da Supabase's Rückgabetyp für Joins nicht exakt mit benutzerdefinierten Interfaces matcht
```

**Verfügbare Service-Methoden:**

| Service | Methoden |
|---|---|
| `unitsService` | getAll, getById, getByCode, create, update, delete, search |
| `ingredientsService` | getAll, getById, getByCode, create, update, delete, getCategories, getUsageCount |
| `recipesService` | getAll, getById, getByCode, create, update, delete, upsertIngredients, scaleRecipe, getAllergens |
| `menusService` | getAll, getById, getByCode, create, update, delete, upsertItems, addItem, removeItem, getCategories |
| `importsService` | getJobs, getJob, createJob, getLogs, getLogsBySeverity |

---

## 9. HOOKS-LAYER-KONVENTIONEN

Alle Hooks unter `hooks/use-*.ts` nutzen **TanStack Query**.

```typescript
// Query-Keys immer als const arrays
export const MENUS_KEY = ['menus'] as const

// Mutations invalidieren immer die Query-Keys
onSuccess: () => qc.invalidateQueries({ queryKey: MENUS_KEY })

// Abhängige Queries nutzen enabled: !!id
```

---

## 10. FORMULAR-KONVENTIONEN

- **React Hook Form + Zod** für alle Formulare
- **defaultValues**: null-Felder aus dem Datenmodell müssen zu `undefined` konvertiert werden

```typescript
// ✅ RICHTIG
defaultValues={{
  short_name: dialog.edit.short_name ?? undefined,
  category:   dialog.edit.category   ?? undefined,
}}

// ❌ FALSCH — null ist nicht zu string | undefined assignierbar
defaultValues={dialog.edit}
```

- **Category-Selects** nutzen `'__none__'` als Sentinel-Wert für "kein Wert"
- **Zahlen-Inputs** immer mit `z.coerce.number()` in Zod

---

## 11. UI-KONVENTIONEN

### Badge-Varianten (components/ui/badge.tsx)

```typescript
variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'error'
// success = emerald, warning = amber, error = red
```

### Sidebar-Typen (components/layout/sidebar.tsx)

```typescript
type NavLeaf  = { label: string; href: string; icon: React.ComponentType<{className?: string}> }
type NavGroup = { label: string; children: NavLeaf[] }
type NavEntry = NavLeaf | NavGroup
const nav: NavEntry[] = [...]
```

### Settings-Seite (app/(admin)/settings/page.tsx)

- Async Server Component
- Zeigt: Verbindungsstatus, Supabase-URL, Key-Status (Set/Missing, nie den Wert)
- Führt Health-Check mit `createServerClient()` auf `units`-Tabelle durch
- Zeigt V3-Schema-Status (welche Felder aktiv/dropped)
- Niemals Anon-Key oder Service-Role-Key im UI anzeigen

---

## 12. MIGRATIONS-REGELN

1. **Historische Migrationen nicht ändern** — sie sind produktiv gelaufen
2. **Neue Änderungen = neue Migration** (additive Follow-up-Migration)
3. Namenskonvention: `YYYYMMDDHHMMSS_beschreibung.sql`
4. Bevorzuge `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`
5. Bei Renames: `ALTER TABLE ... RENAME COLUMN`
6. Bei Drops: `DROP COLUMN IF EXISTS`

---

## 13. OFFENE ZUKUNFTSMODULE

Diese Module sind in der Settings-Seite gelistet und architektonisch vorbereitet (DB-Stubs existieren), aber **vollständig unimplementiert**:

| Modul | DB-Tabellen vorhanden | Status |
|---|---|---|
| Events & Event Menus | `events`, `event_menus` | STUB |
| Purchasing Lists | `purchasing_lists`, `purchasing_list_items` | STUB |
| Production Batches | `production_batches` | STUB |
| Supplier Management | `suppliers` | STUB |
| Food Cost Calculation | — | geplant |
| AI Menu Recognition | — | geplant |
| AI Recipe Matching | — | geplant |
| AI Ingredient Mapping | — | geplant |

**Beim Implementieren dieser Module:**
- Neue SQL-Migrations schreiben (nicht bestehende ändern)
- TypeScript-Typen in `types/database.ts` als `type` (nicht `interface`) hinzufügen
- Die Stub-Tabellen haben keine TypeScript-Repräsentation im `Database`-Typ — das muss ergänzt werden
- Kitchen-Pages (`/kitchen/production`, `/kitchen/purchasing`) sind leere Stubs

---

## 14. BEKANNTE TECHNISCHE CONSTRAINTS

### TypeScript interface vs type (KRITISCH)

In TypeScript 5.9.3 ist für die Supabase `createClient<Database>` Funktion zwingend erforderlich:
- `Database` selbst: `export type Database = {...}` (kein `interface`)
- Alle Row-Typen: `export type Unit = {...}` (kein `export interface Unit`)
- Grund: `interface` satisfies `Record<string, unknown>` nicht in conditional-type-Evaluation → `Schema = never` → alle Supabase-Operationen typen als `never`

### Supabase-Version

`@supabase/supabase-js@2.106.2` und `@supabase/postgrest-js@2.106.2`.
`GenericTable` erfordert `Insert: Record<string, unknown>` — nur `type`-Aliases sind kompatibel.

### Import-Engine finished_at

`ImportJobInsert` enthält `finished_at` als Pflichtfeld (da `Omit<ImportJob, 'id'|'started_at'>`). Beim Initial-Insert muss `finished_at: null` explizit übergeben werden.

### Deutsch-Zahlenformat im Importer

`parseGermanNumber()` in `ValidationEngine.ts` verarbeitet:
- `"1.000,5"` → `1000.5`
- `"1,5"` → `1.5`
- `"200"` → `200`

---

## 15. API-ROUTEN

```
POST /api/imports
  Body: FormData { file: .xlsx, dryRun: 'true'|'false' }
  Server-Side: ExcelImportEngine mit createServerClient()
  Returns: ImportResult

GET /api/imports
  Returns: ImportJob[] (letzte 50)

GET /api/imports/[id]
  Returns: { job: ImportJob, logs: DataImportLog[] }

DELETE /api/imports/[id]
  Setzt import_jobs.status = 'rolled_back'
  Returns: { success: true }
```

---

## 16. KONSTANTEN (types/index.ts)

```typescript
ALLERGENS: readonly string[]  // 14 EU-Allergene auf Deutsch
INGREDIENT_CATEGORIES: readonly string[]  // 14 Kategorien
MENU_CATEGORIES: readonly string[]  // 8 Kategorien: Frühstück, Mittagessen, Abendessen, Buffet, Fingerfood, Dessert, Getränke, Sonstiges
```

---

## 17. V3 FIELD-NAME-REFERENZ (Source of Truth)

| Alt (V2) | Neu (V3) | Status |
|---|---|---|
| `menus.name` | `menus.menu_name` | ✅ aktiv |
| `menus.description` | `menus.menu_description` | ✅ aktiv |
| `menus.service_note` | — | ❌ dropped |
| `menus.menu_type` | — | ❌ dropped (war nur TypeScript) |
| `menu_recipes` (Tabelle) | `menu_items` (Tabelle) | ✅ aktiv |
| `menu_recipes.portion_count` | — | ❌ dropped |
| `menu_recipes.portion_unit_id` | — | ❌ dropped |

**Keine anderen V2-Feldnamen sind mehr im aktiven Code vorhanden.**

---

*Diese Datei vollständig lesen und als Grundlage für alle Prompt-Formulierungen verwenden.*
*Letzte Aktualisierung: 2026-06-03 nach abgeschlossener V3-Migration.*
