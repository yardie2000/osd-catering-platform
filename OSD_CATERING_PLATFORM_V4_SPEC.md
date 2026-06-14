# OSD Catering Platform — Vollständige Projektspezifikation V4
**Stand: 2026-06-13 | Release: V4.2 | App-Version 4.2.0 | Autoritative Referenz (löst V3-Spec ab)**

> **V4.2 (Rechen-Engine):** Production = Required × (1 + Verlust %); Purchasing = Production ÷ Yield %
> (globale Defaults 10 % / 80 %, je Rezept überschreibbar: `recipes.production_loss_pct`, `yield_pct`).
> Einheiten-Klassifizierung (Masse/Volumen vs. „n. Bedarf"); UI als Kitchen-Operations-Dashboard.
> Migration `20260613000001`. Details: Audit/Changelog in `audit/`.

> **V4.1 (Workflow-Refactoring):** Production & Purchasing sind **keine getrennten Eingaben** mehr.
> Es gibt EINE Eingabe — den **Kitchen Production Batch** (`/operations/batches`) — aus dem Production
> Output und Purchasing Output **abgeleitet** werden (gemeinsamer Aggregation-Service). Details: **§21**.
> Die alten Standalone-Rechner unter `/kitchen/*` wurden entfernt.

---

## ZWECK DIESER DATEI

Diese Datei ist die **einzige autoritative Referenz** für alle Entwicklung ab V4.
Sie enthält: Systemzweck, Architektur, Tech-Stack, das **real verifizierte** Datenbankschema
(Live-Stand, nicht nur das in Migrationen Beabsichtigte), alle Dateinamen/Funktionen,
Konventionen, die V4-Neuerungen und die vorbereitete V4-Roadmap.

> **Wichtigster Grundsatz dieser Spec:** Bei Abweichung zwischen Repo-Migrationen, alter
> Spec und Live-Datenbank gilt **der reale produktive Stand der Live-DB**. Abschnitt 4
> dokumentiert diese Divergenzen explizit. *Nicht blind den historischen Migrationen vertrauen.*

Die Vorgängerdatei `OSD_CATERING_PLATFORM_V3_SPEC.md` bleibt als Historie erhalten, ist aber
**nicht mehr maßgeblich** (sie beschreibt u. a. ein `menu_items`-Schema, das so nie live war).

---

## 0. WAS IST NEU IN V4 (Changelog gegenüber V3)

| Bereich | V3 | V4 |
|---|---|---|
| Menü-Position ↔ Rezept | Spec: Pflicht-`recipe_id`; live: gar kein Link, nur Standalone-Zeilen | **Standalone-Zeile + OPTIONALER `recipe_id`** (nullable), FK aktiv, im UI pflegbar |
| Menü-Detail-UI | Fuzzy-Namens-Heuristik als Behelf | **`MenuRecipePicker`**: Suche nach Name/Code, Link/Change/Unlink, Reihenfolge ändern |
| Importer | `menu_items` ohne Rezeptbezug | **Rezeptcode-basiertes Mapping** (`recipe_code`-Spalte) + Exakt-Eindeutig-Namens-Fallback, Linked/Unlinked-Logs |
| Settings | „Schema V3", generische Zukunftsliste | **„Schema V4"**, Roadmap-Karten Production Planning / Purchasing als „Coming Soon" mit Hinweis auf vorhandene Tabellen |
| Sidebar-Footer | „OSD Catering Platform V3" | „OSD Catering Platform V4" |
| RLS | anon nur SELECT | anon FULL CRUD auf die 6 UI-Tabellen (Migration `…0006`) |

**Hinweis zur Entwicklung dieses Dokuments:** Die früh-V4-Darstellung „Production Planning &
Purchasing = Coming Soon" ist überholt. Beide wurden in V4 als Kalkulation gebaut und in **V4.1**
zum einheitlichen **Kitchen-Production-Batch-Workflow** zusammengeführt (eine Eingabe → Production
Output + Purchasing Output, **§21**). Wo unten noch „Coming Soon" steht, ist das historischer Kontext.

---

## 1. SYSTEMZWECK

Das System ist **kein allgemeines Eventmanagement-Tool**.
Es ist ein **operativer Calculation-Engine-Layer** für Catering-Produktionen.

**Kernfunktionen (aktiv):**
- Menü-Kalkulation (welche Rezepte/Positionen sind in einem Menü)
- Menü-Position ↔ Rezept-Verknüpfung (Basis für Skalierung & Einkauf)
- **Kitchen Production Batch (V4.1):** eine Eingabe (Menüs + Pax) als zentraler Planungsprozess
- **Production Output:** Mengenskalierung & Produktionslisten je Rezept (aus dem Batch abgeleitet)
- **Purchasing Output:** Zutaten-Aggregation & Einkaufsliste nach Kategorie (aus demselben Batch)
- Excel-Import-Engine für Stammdaten

> Kernprinzip V4.1: `Verkaufte Menüs → Production Batch → Rezeptaggregation → Production & Purchasing`.
> Production und Einkauf sind **keine getrennten Eingaben**, sondern Ableitungen derselben Planung (§21).

**Ausserhalb des Systems (bewusst nicht integriert):**
- Events / Gästemanagement → **Mouseclick** (extern); hier wird nur Menü+Pax je Batch erfasst
- CrewBrain (externes Tool)

---

## 2. PROJEKTPFAD UND TECH STACK

```
Projektpfad:  D:\Downloads\files\catering-platform-v3
Arbeitsverz:  D:\Downloads\files
Supabase-Ref: mbtzqghyjoxhsluzglkz
```

| Technologie | Version | Zweck |
|---|---|---|
| Next.js | 15.0.3 | Framework, App Router (Turbopack dev) |
| React | 19.x | UI |
| TypeScript | 5.x (strict) | Sprache |
| Supabase JS | 2.x | Datenbankzugang (PostgREST) |
| PostgreSQL | via Supabase | Datenbank |
| TanStack Query | 5.x | Client-State / Caching |
| React Hook Form | 7.x | Formulare |
| Zod | 3.x | Validierung |
| shadcn/ui + Tailwind | — | UI-Komponenten (Radix-basiert) |
| xlsx | 0.18.5 | Excel-Import |
| Lucide React | 0.460 | Icons |
| Sonner | — | Toast-Notifications |

---

## 3. VERZEICHNISSTRUKTUR (V4-relevante Auszüge)

```
catering-platform-v3/
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── master-data/
│   │   │   ├── units/page.tsx
│   │   │   ├── ingredients/page.tsx
│   │   │   ├── recipes/{page,[id]/page,[id]/edit/page,new/page}.tsx
│   │   │   └── menus/
│   │   │       ├── page.tsx                 # Menü-Liste (CRUD)
│   │   │       └── [id]/page.tsx            # ⭐ Menü-Detail: Rezept-Verknüpfung (V4)
│   │   ├── operations/
│   │   │   ├── {imports,validation,data-quality}/page.tsx
│   │   │   ├── batches/page.tsx             # ⭐ V4.1: Production-Batch-Liste (CRUD)
│   │   │   ├── batches/[id]/page.tsx        # ⭐ V4.1: DIE EINZIGE EINGABE — Menüs + Pax
│   │   │   ├── production/page.tsx          # ⭐ V4.1: Production Output (je Rezept) + Sheet/CSV
│   │   │   └── purchasing/page.tsx          # ⭐ V4.1: Purchasing Output (nach Kategorie) + Sheet/CSV
│   │   └── settings/page.tsx                # V4.1-Schema-Info + Operations-Workflow
│   ├── api/imports/{route.ts,[id]/route.ts}
│   ├── layout.tsx (Titel „…V4") · globals.css · page.tsx
├── components/
│   ├── layout/{app-layout,page-header,sidebar}.tsx     # Nav-Gruppe „Operations"; Footer „…Platform V4"
│   ├── master-data/menus/
│   │   └── menu-recipe-picker.tsx           # V4: Rezept-Such-/Auswahl-Dialog
│   └── ui/{badge,button,card,dialog,input,select,separator,table,textarea}.tsx
├── hooks/
│   ├── use-menus.ts                         # + useSetMenuItemRecipe, useReorderMenuItems (V4)
│   └── use-batches.ts                        # ⭐ V4.1: Batches/Items-CRUD + useBatchOutputs
├── lib/
│   ├── supabase/{client,server}.ts
│   ├── importers/                           # ExcelImportEngine, RecipeImporter (recipeCodeMap),
│   │                                        #   MenuItemImporter (recipe_id-Mapping), ValidationEngine, …
│   ├── purchasing/aggregate.ts              # Zutaten-Aggregation + Einheiten-Merge (wiederverwendet)
│   ├── production/plan.ts                    # Batch-je-Rezept-Skalierung (wiederverwendet)
│   ├── operations/computeBatchOutputs.ts    # ⭐ V4.1: gemeinsamer Aggregation-Service (eine Datenbasis)
│   └── {errors,utils}.ts
├── services/
│   ├── menus.service.ts                     # + embed recipe, setItemRecipe, updateItem, reorderItems
│   ├── purchasing.service.ts                # getMenusForCalc (inkl. category) + getSupplierProducts (geteilt)
│   ├── batch.service.ts                     # ⭐ V4.1: Batch-CRUD + getOutputs (Production + Purchasing)
│   └── {recipes,ingredients,units,imports}.service.ts
├── supabase/migrations/                     # siehe Abschnitt 4 (… bis 20260606000003)
├── types/{database.ts,index.ts}
├── OSD_CATERING_PLATFORM_V4_SPEC.md         # diese Datei (V4.1)
└── OSD_CATERING_PLATFORM_V3_SPEC.md         # SUPERSEDED (Historie)
```

> **Entfernt in V4.1 (keine Altlasten):** `app/(admin)/kitchen/*` (Standalone-Rechner),
> `hooks/use-purchasing.ts`, `hooks/use-production.ts`, `services/production.service.ts`.

⭐ = in V4 / V4.1 neu oder geändert.

---

## 4. DATENBANKSCHEMA V4 (real verifiziert, Live-Stand 2026-06-05)

### 4.1 Migrations-Reihenfolge

| Migration | Zweck |
|---|---|
| `20260601000001_v2_schema.sql` | Basis: units, ingredients, recipes, recipe_ingredients, menus, menu_recipes, import_jobs, data_import_log, Zukunfts-Stubs |
| `20260601000002_v3_additions.sql` | menus.+price_per_person, +service_note; supplier_products |
| `20260601000003_recipe_ingredients_kolli.sql` | recipe_ingredients.+package_qty, +package_unit |
| `20260603000001_v3_menus_items.sql` | menus rename (name→menu_name, description→menu_description); CREATE menu_items; DROP menu_recipes |
| `20260603000002_v3_foreign_keys.sql` | Fehlende FKs nachgezogen (PostgREST-Embeds) — **ohne** menu_items→recipes |
| `20260603000003_menus_price_per_person.sql` | menus.price_per_person live nachgezogen |
| `20260603000004_menu_items_id_default.sql` | menu_items.id → DEFAULT gen_random_uuid() |
| `20260603000005_menu_items_allergens.sql` | menu_items.+allergens text[] |
| `20260603000006_anon_write_policies.sql` | anon FULL CRUD auf die 6 UI-Tabellen (App hat kein Login) |
| `20260605000001_menu_items_recipe_link.sql` | ⭐ **V4**: menu_items.recipe_id nullable + FK + Index + konservativer Backfill |
| `20260606000001_persistence_policies.sql` | ⭐ **V4**: anon CRUD-Policies für `purchasing_lists`/`purchasing_list_items`/`production_batches` + „Portion"-Einheit |
| `20260606000002_production_station.sql` | ⭐ **V4**: `production_batches.station` (Stationszuteilung) |
| `20260606000003_kitchen_batches.sql` | ⭐ **V4.1**: `kitchen_batches` + `kitchen_batch_items` (zentrale Eingabe) + anon-RLS |

> ⚠️ **Repo-Migrationen ≠ Live-DB.** Die historischen Migrationen reproduzieren die Live-DB
> **nicht** vollständig (die Live-DB wurde teils per Hand/SQL-Editor aufgebaut). Insbesondere
> erzeugt **keine** Migration die Spalten `menu_items.name/description/dietary/item_price` —
> live existieren sie trotzdem. Für Schema-Wahrheit gilt 4.2, nicht die Migrationsdateien.

### 4.2 Reales Live-Schema der zentralen Tabellen

```sql
public.recipes                         -- recipe_code ist snake_case (NICHT recipecode)
  id               UUID PK
  recipe_code      TEXT UNIQUE NOT NULL
  name             TEXT NOT NULL
  description      TEXT
  yield_quantity   NUMERIC
  yield_unit_id    UUID → units.id (SET NULL)
  preparation      TEXT
  usage_notes      TEXT
  production_notes TEXT
  shelf_life       TEXT
  scalable         BOOLEAN DEFAULT true
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

public.menus
  id               UUID PK
  menu_code        TEXT UNIQUE NOT NULL
  menu_name        TEXT NOT NULL
  menu_description TEXT
  category         TEXT
  price_per_person NUMERIC
  active           BOOLEAN DEFAULT true
  created_at       TIMESTAMPTZ
  updated_at       TIMESTAMPTZ

public.menu_items                       -- ⭐ V4: Standalone-Zeile MIT optionalem Rezept-Link
  id          UUID PK   DEFAULT gen_random_uuid()
  menu_id     UUID NOT NULL → menus.id (CASCADE)
  recipe_id   UUID NULL     → recipes.id (SET NULL)   -- ⭐ optional! FK = menu_items_recipe_id_fkey
  name        TEXT NOT NULL                            -- eigener Anzeigename der Position
  description TEXT                                      -- enthält oft kuratierte Rezeptcodes/Notizen
  dietary     TEXT                                      -- z. B. "vegan", "vegan/vegetarisch"
  item_price  NUMERIC NULL
  allergens   TEXT[] NOT NULL DEFAULT '{}'              -- deutsche Allergennamen
  sort_order  INTEGER NOT NULL DEFAULT 0
  -- HINWEIS: live KEINE created_at / updated_at auf menu_items
  -- HINWEIS: KEIN unique(menu_id, recipe_id) (gleiches Rezept darf mehrfach vorkommen)
  INDEX idx_menu_items_recipe (recipe_id)
```

**Datenstand (2026-06-05):** 92 menu_items, 83 recipes, **68 Positionen verknüpft** (51 eindeutig
per Code, 17 mit führender Komponente bei Mehrfach-Codes), 24 ohne vorhandenes Rezept (laut
description „Kein Rezept in DB" / „Einkauf").

### 4.3 Weitere aktive Tabellen (unverändert ggü. V3)

`units`, `ingredients`, `recipe_ingredients` (+ package_qty/package_unit),
`supplier_products`, `import_jobs`, `data_import_log` — Felder wie V3-Spec Abschnitt 4.

### 4.4 V4.1-Operations-Tabellen + Legacy

```
-- V4.1 aktiv (zentrale Eingabe; Migration 20260606000003):
public.kitchen_batches           -- Production Batch (name, dates, status, …)
public.kitchen_batch_items       -- batch_id, menu_id, pax_count (unique batch+menu)

-- Legacy (existieren, vom V4.1-Flow NICHT genutzt — nicht gedroppt):
public.production_batches        -- per-Rezept (pre-V4.1 Persistenz)
public.purchasing_lists          -- pre-V4.1 Persistenz
public.purchasing_list_items     -- pre-V4.1 Persistenz

-- Stubs (später):
public.events
public.suppliers
```
Alle in **snake_case** (verifiziert: `production_batches`, NICHT `productionbatches`).

### 4.5 Row Level Security

- `authenticated`: FULL ACCESS (USING true / WITH CHECK true) auf alle Tabellen.
- `anon`: **FULL CRUD** auf `units, ingredients, recipes, recipe_ingredients, menus, menu_items`
  (Migration `…0006`). Grund: die Browser-App nutzt den ANON-Key und hat kein Login.
  ⚠️ Für eine öffentliche Bereitstellung stattdessen echtes Auth einführen und Writes auf
  `authenticated` beschränken.

---

## 5. TYPESCRIPT-TYPEN (types/database.ts)

### 5.1 Kritische Konvention — NIEMALS BRECHEN

Alle Entity-Typen als **`type`**, niemals `interface`. Grund: Supabase `createClient<Database>`
braucht `Row/Insert/Update extends Record<string, unknown>`; `interface` erfüllt das im
Conditional-Type-Check nicht → `Schema = never` → alle `.insert/.update/.select` typen als `never`.

### 5.2 V4-Menümodell-Typen (real)

```typescript
type MenuItem = {
  id:          string
  menu_id:     string
  recipe_id:   string | null        // ⭐ V4: real, nullable (war in V3 optional/fehlend)
  name:        string
  description: string | null
  dietary:     string | null
  item_price:  number | null
  allergens:   string[]
  sort_order:  number
  // KEIN created_at / updated_at (entspricht Live-DB)
}

type MenuItemInsert = Omit<MenuItem, 'id' | 'allergens' | 'recipe_id'> & {
  allergens?: string[]
  recipe_id?: string | null
}
type MenuItemUpdate = Partial<MenuItemInsert>

// Join mit (optionalem) Rezept — von menusService.getById geliefert
type MenuItemWithDetails = MenuItem & { recipe: Recipe | null }
type MenuWithItems       = Menu & { menu_items: MenuItemWithDetails[] }
```

`Database.public.Tables.menu_items.Relationships` enthält **zwei** FKs:
`menu_items_menu_id_fkey` (→menus) und `menu_items_recipe_id_fkey` (→recipes).

---

## 6. SUPABASE-VERBINDUNG

```env
NEXT_PUBLIC_SUPABASE_URL=https://mbtzqghyjoxhsluzglkz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...        # Browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...            # Server (Import, Health-Check)
```

- `lib/supabase/client.ts` → Browser-Singleton (ANON). **Services nutzen immer diesen.**
- `lib/supabase/server.ts` → `createServerClient()` (SERVICE_ROLE). **API-Routes + ImportEngine.**

> **DDL/Migrationen:** ANON- und SERVICE-ROLE-Key sind PostgREST-JWTs und können **kein DDL**.
> Migrationen werden über den **SQL-Editor** (kein Secret nötig) oder per DB-Passwort/CLI/psql
> ausgeführt. `supabase db push` ist hier riskant (Remote-Migrationshistorie unvollständig →
> würde historische Migrationen erneut abspielen) — bevorzugt **nur die neue Migration** direkt
> ausführen.

---

## 7. IMPORT-ENGINE (V4)

### 7.1 Importer-Chain

```
POST /api/imports → ExcelImportEngine.run()
  1. UnitImporter        → unitIdMap
  2. IngredientImporter  → ingredientIdMap (+ codeMap)
  3. SupplierImporter    → nutzt ingredientIdMap
  4. RecipeImporter      → recipeIdMap (Excel-Nr→UUID) + ⭐ recipeCodeMap (recipe_code→UUID)
  5. RecipeIngredient    → nutzt recipeIdMap/ingredientIdMap/unitIdMap
  6. MenuImporter        → menuMap (menu_code→UUID)
  7. MenuItemImporter    → ⭐ nutzt menuMap + recipeCodeMap
```

### 7.2 Menü-Positionen-Mapping (⭐ V4)

`MenuItemImporter` setzt `recipe_id` robust:
1. **Explizite `recipe_code`-Spalte** im menu_items-Sheet → Lookup in (DB-weiter recipe-Code-Map
   ∪ Run-`recipeCodeMap`). Nicht gefundener Code → **Warnung**, Zeile bleibt unverknüpft.
2. **Fallback:** exakt-**eindeutiger** Rezept-Name = Positions-Name → Link.
3. Sonst: `recipe_id = null` (legitime Standalone-Zeile).
Logsummary: `Menu Items: N inserted (X linked to recipes, Y without recipe), …`.

### 7.3 menu_items-Zod-Schema (real, V4)

```typescript
menuItemRowSchema = {
  menu_code:   string (required)
  name:        string (required)
  recipe_code: string | null (optional)        // ⭐ V4: optionaler Rezept-Link
  description: string | null (optional)
  dietary:     string | null (optional)
  allergens:   string|string[] → string[]       // Komma/Semikolon-getrennt
  item_price:  number | null (German-Format)
  sort_order:  number int (default 0)
}
```
> Achtung: Die alte V3-Spec behauptete `recipe_code` sei **required** und es gäbe nur
> `menu_code/recipe_code/sort_order`. Das war **falsch**. Real ist das Standalone-Schema oben.

### 7.4 Sheet-Aliase & Zeilenversatz

Wie V3: `range:2` für units/ingredients/recipes/recipe_ingredients/suppliers (Header Zeile 3),
`range:0` für menus/menu_items (Header Zeile 1). Aliase u. a. `menu_items / menü_items / menu_positionen`.

---

## 8. SERVICE-LAYER (menusService — V4)

```typescript
menusService = {
  getAll(opts?)                          // Menu[]
  getById(id)                            // ⭐ MenuWithItems — embeddet menu_items(*, recipe:recipes(*))
                                         //    geordnet nach sort_order
  getByCode(code)
  create(payload) / update(id, payload) / delete(id)
  upsertItems(menuId, items)             // Full-Replace (items dürfen recipe_id tragen)
  addItem(menuId, item, sortOrder)       // ⭐ item kann recipe_id enthalten
  updateItem(menuItemId, patch)          // ⭐ V4: generisches Patch (z. B. sort_order)
  setItemRecipe(menuItemId, recipeId|null) // ⭐ V4: Link/Change/Unlink
  reorderItems([{id, sort_order}])       // ⭐ V4: Reihenfolge persistieren
  removeItem(menuItemId)
  getCategories()
}
```
Embedding-Query: `menus.select('*, menu_items(*, recipe:recipes(*))').order('sort_order', { referencedTable: 'menu_items' })`.
Fehlerbehandlung immer `if (error) throw error`. Joins ggf. `as MenuWithItems`.

---

## 9. HOOKS (use-menus.ts — V4)

```typescript
MENUS_KEY = ['menus']
useMenus(opts?) · useMenu(id) · useMenuCategories()
useCreateMenu · useUpdateMenu · useDeleteMenu
useAddMenuItem(menuId)            // item inkl. optional recipe_id
useSetMenuItemRecipe(menuId)      // ⭐ V4 — { menuItemId, recipeId|null }
useReorderMenuItems(menuId)       // ⭐ V4 — [{ id, sort_order }]
useRemoveMenuItem(menuId)
```
Alle Mutations invalidieren `[...MENUS_KEY, menuId]` (Detail) bzw. `MENUS_KEY` (Liste) im `onSuccess`.

---

## 10. UI — MENÜ-DETAIL & REZEPT-PICKER (⭐ V4)

### 10.1 `components/master-data/menus/menu-recipe-picker.tsx`

Eigenständige, touch-/dark-taugliche `Dialog`-Komponente:
- Sucht via `useRecipes({ search })` **nach Name UND Code**.
- Eine scrollbare Liste (kein Modal-Stacking), Zeilen als Buttons (Name + `recipe_code`).
- Markiert die aktuell verknüpfte Auswahl (`selectedRecipeId`), `onSelect(recipe)`-Callback.
- Nutzt nur bestehende shadcn-Primitives (Dialog/Input/Badge) — **keine neuen Dependencies**.

Props: `{ open, onOpenChange, onSelect, selectedRecipeId?, title?, description? }`.

### 10.2 `app/(admin)/master-data/menus/[id]/page.tsx`

- Lädt `useMenu(id)` → `MenuWithItems` (mit eingebettetem `recipe`).
- Header: „<code> · N item(s) · **X/N linked to recipes**".
- Pro Position:
  - **Verknüpft:** Rezeptname + `recipe_code`, Buttons **Change** (Picker) / **Unlink** (`setItemRecipe(null)`).
  - **Unverknüpft:** Badge „No linked recipe", **Link recipe** (Picker) + **Create recipe**
    (`/master-data/recipes/new?name=<encoded>`).
  - **Move up / Move down** → `reorderItems` (sequenzielle sort_order).
  - **Remove** (Trash).
- „Add Item"-Dialog: optionaler **„Link a recipe"** (Picker); bei Auswahl wird der Positionsname
  vorausgefüllt, falls leer.
- Die frühere Fuzzy-Namens-Heuristik (`useQueries`/`getRecipeMatch`) wurde **entfernt**.

---

## 11. UI — SETTINGS (V4.1-Kommunikation)

`app/(admin)/settings/page.tsx` (async Server Component):
- Health-Check via `createServerClient()` auf `units` → Detail „Connected — **schema V4 active**".
- **Schema Status** (Badge **V4**): aktive Felder inkl. `menu_items.recipe_id`,
  `kitchen_batches`/`kitchen_batch_items` (V4.1, aktiv); `production_batches`/`purchasing_lists` als **Legacy**.
- **Operations Workflow (V4.1)**-Karte (Badge „Live"): eine Eingabe (Batch) → Production + Purchasing
  über gemeinsamen Aggregation-Service; `Menüs + Pax → Production Batch → Rezeptaggregation → Outputs`.
- **Production Output** (Badge „Live"): je Rezept skaliert, Prep-Liste, Kitchen Production Sheet/CSV.
- **Purchasing Output** (Badge „Live"): nach Kategorie gruppiert, Einheiten-Merge, Purchasing Sheet/CSV;
  Kosten/Lieferant „◷ ready — needs supplier_products data (empty)".
- **Further Scaffolding**: Events (Mouseclick extern), Supplier Management, Food Cost, AI-Module.

Keine Marketing-Übertreibung, keine Falschaussagen über fertige Features. Keys nie im Klartext.
Sidebar-Footer (`components/layout/sidebar.tsx`): „OSD Catering Platform **V4**"; Nav-Gruppe **„Operations"**.

---

## 12. KONVENTIONEN (Formulare, UI, Migrationen)

- **Formulare:** React Hook Form + Zod; `null → undefined` in `defaultValues`; Selects nutzen
  `'__none__'`-Sentinel; Zahlen via `z.coerce.number()` bzw. `z.preprocess('' → undefined)`.
- **Badges:** `default | secondary | destructive | outline | success(emerald) | warning(amber) | error(red)`.
- **Fehler-Toasts:** `getErrorMessage(e)` aus `lib/errors.ts` (nicht `String(e)`).
- **Migrationen:** historische **nie** ändern; nur additive Follow-ups; `YYYYMMDDHHMMSS_*.sql`;
  idempotent (`IF NOT EXISTS`, guarded DO-Blocks); am Ende `NOTIFY pgrst, 'reload schema'`.

---

## 13. MIGRATION `20260605000001_menu_items_recipe_link.sql` (⭐ V4-Kern)

Idempotent; harmonisiert Live-DB **und** Fresh-Deploys auf das V4-Modell:
1. `ADD COLUMN IF NOT EXISTS recipe_id uuid`
2. `ALTER COLUMN recipe_id DROP NOT NULL` (Fresh-Deploys hatten NOT NULL)
3. `DROP CONSTRAINT IF EXISTS menu_items_menu_recipe_key` (unique entfernen)
4. FK `menu_items_recipe_id_fkey → recipes(id) ON DELETE SET NULL` — nur falls noch kein FK auf
   `recipe_id` existiert (bestehenden Live-FK nicht anfassen)
5. `CREATE INDEX IF NOT EXISTS idx_menu_items_recipe (recipe_id)`
6. **Konservativer Backfill:** verknüpft nur, wenn der Positions-Name **exakt-eindeutig** einem
   Rezeptnamen entspricht (für aktuelle Daten 0 Zeilen — bewusst). Nutzt korrelierte
   `count(*)=1`-Subquery (kein `min(uuid)` — existiert nicht!).
7. `COMMENT ON COLUMN` + `NOTIFY pgrst`.

**Status:** auf der Live-DB **angewendet** (verifiziert: `recipe_id` nullable, Index vorhanden,
FK-Embed löst auf). Datei im Repo identisch → Fresh-Deploys konsistent.

---

## 14. BEKANNTE CONSTRAINTS / FALLEN

- **`interface` vs `type`** (siehe 5.1) — kritisch.
- **`min(uuid)` existiert nicht** in Postgres → bei „eindeutiger Match"-Logik korrelierte
  `count(*)=1`-Subquery statt Aggregat verwenden.
- **Repo-Migrationen ≠ Live-DB** (siehe 4.1) — ein `supabase db reset` erzeugt **nicht** das
  Live-Schema. Schema-Wahrheit = Abschnitt 4.2.
- **ImportJobInsert.finished_at** muss beim Initial-Insert explizit `null` sein.
- **parseGermanNumber:** `"1.000,5"→1000.5`, `"1,5"→1.5`, `"200"→200`.

---

## 15. API-ROUTEN (unverändert)

```
POST   /api/imports        FormData{ file:.xlsx, dryRun } → ImportResult
GET    /api/imports        → ImportJob[] (letzte 50)
GET    /api/imports/[id]   → { job, logs }
DELETE /api/imports/[id]   → status='rolled_back'
```

---

## 16. KONSTANTEN (types/index.ts)

`ALLERGENS` (14 EU-Allergene, Deutsch), `INGREDIENT_CATEGORIES` (14),
`MENU_CATEGORIES` (8: Frühstück, Mittagessen, Abendessen, Buffet, Fingerfood, Dessert, Getränke, Sonstiges).
Excel-Allergene sind EU-Nummern 1–14 (1=Gluten … 14=Weichtiere, gleiche Reihenfolge wie `ALLERGENS`).

---

## 17. FIELD-NAME-REFERENZ (V4 Source of Truth)

| Bereich | Realer V4-Stand |
|---|---|
| `menus` | `menu_code, menu_name, menu_description, category, price_per_person, active, created_at, updated_at` |
| `menu_items` | `id, menu_id, recipe_id?(null), name, description, dietary, item_price, allergens[], sort_order` — **kein** created_at/updated_at, **kein** unique(menu_id,recipe_id) |
| `recipes` | `recipe_code` (snake_case), `name`, … |
| Menü↔Rezept | über `menu_items.recipe_id` (nullable, FK SET NULL) |
| Operations (V4.1) | `kitchen_batches`, `kitchen_batch_items` (zentrale Eingabe) |
| Legacy-Tabellen | `production_batches`, `purchasing_lists`, `purchasing_list_items` (pre-V4.1, ungenutzt) |

---

## 18. MODUL-STATUS & ROADMAP

| Modul | Tabellen | Status |
|---|---|---|
| Production Output | `kitchen_batches`/`_items` (+ Rezepte) | **Live (V4.1)** — aus Batch abgeleitet (§21/§20) |
| Purchasing Output | `kitchen_batches`/`_items` (+ Rezepte) | **Live (V4.1)** — aus Batch abgeleitet (§21/§19) |
| Events & Event Menus | `events`, `event_menus` | extern (Mouseclick); kein Tool geplant |
| Supplier Management | `suppliers` | Stub — aktivierbar, sobald Lieferantendaten existieren |
| Food Cost Calculation | `supplier_products` | Logik vorhanden, wartet auf Preisdaten |
| AI Menu/Recipe/Ingredient | — | geplant |

**Offene Folge-Features (V4.x):** Ingredient-`category` & `supplier_products` pflegen (aktiviert
Kategorie-Gruppierung + Kosten/Lieferant automatisch); optional per-Rezept-Timeline/Station auf dem
Batch-Flow; persistierte Output-Snapshots (Preis-Freeze) — nur falls fachlich nötig.
**Beim Implementieren:** additive Migrationen; neue Tabellen im `Database`-Typ registrieren.

---

## 19. PURCHASING-AGGREGATION (Logik — Eingabe/Output: §21)

> Seit **V4.1** ist die Eingabe der **Kitchen Production Batch** (§21), das UI der
> **Purchasing Output** (`/operations/purchasing`). Dieser Abschnitt dokumentiert die
> wiederverwendete **Aggregationslogik** (`lib/purchasing/aggregate.ts#aggregatePurchasing`).

**Datenfluss (nur Lesen):** `menus → menu_items(recipe_id) → recipes → recipe_ingredients → ingredients`
(+ `ingredients.category`), plus `supplier_products` (Kosten/Vergleich). Deep-Embed in
`services/purchasing.service.ts#getMenusForCalc`.

**Skalierung je Rezept = Anzahl ÷ Portionsbasis** (`resolveBase`, Priorität):
1. `recipe.yield_quantity` (strukturiert) — **nur 10 von 83 Rezepten** haben das.
2. Sonst aus `recipe.production_notes` geparst (`parseBasePortions`: „60–70 Portionen" → 65; „= 50 Portionen" → 50).
3. Sonst Default **50** (V4.1: fix in `computeBatchOutputs`, damit Production = Purchasing).
Aggregiert per (Zutat, **kanonische** Einheit).

**Einheiten-Zusammenführung:** DB hat KEINE `conversion_factor`/`base_unit`-Daten (alle NULL) →
eingebaute metrische Konstanten (`canonicalize`): kg→g (×1000), l→ml (×1000). Nicht-metrische Einheiten
(Stück, EL, Geschmack, Bedarf …) bleiben getrennt. Verifiziert: keine kg/l-Zeilen mehr nach Aggregation.

**Output:** `PurchasingLine[]` (inkl. `category`) + `warnings` (Position ohne Rezept; Rezept ohne Zutaten)
+ `assumptions` (Rezepte ohne strukturiertes Yield) + `totalCost`. Im UI nach **Kategorie** gruppiert,
Sheet/CSV.

**Daten-Realität (verifiziert 2026-06-06):** 83 Rezepte / 55 mit Zutaten / 10 mit `yield_quantity`
(Mengen batch-/portionsbasiert ~50–70 → mehrstufige Basis nötig). `supplier_products` **leer (0)** und
`ingredients.category`/`supplier_name` leer → Kosten/Lieferant + Kategorie-Gruppierung greifen
automatisch, sobald diese Stammdaten gepflegt sind; bis dahin „—" bzw. eine Gruppe „Ohne Kategorie".
`suppliers`-FK bewusst nicht verdrahtet (keine Quelldaten).

**Legacy:** Die V4-Persistenz (`purchasing_lists`/`_items` + Standalone-Seite) wurde in V4.1 entfernt;
die Tabellen bleiben als Legacy in der DB.

## 20. PRODUCTION-AGGREGATION (Logik — Eingabe/Output: §21)

> Seit **V4.1**: Eingabe = Batch (§21), UI = **Production Output** (`/operations/production`).
> Wiederverwendete Logik: `lib/production/plan.ts#buildProductionPlan`.

**Output = ein Produktionsbatch je Rezept:** ein Rezept, das in mehreren Menüs des Batches vorkommt,
wird zu **einem** Eintrag summiert (`portions_needed` = Σ der Pax der Menüs, die das Rezept enthalten).
**Skalierung = portions_needed ÷ Portionsbasis** (gleiche `resolveBase`-Logik wie §19); `batch_factor`
= portions_needed/base; pro Batch werden die Rezeptzutaten mit dem Faktor skaliert (Prep-Liste).
Output enthält `assumptions` + `warnings` analog §19. Im UI je Rezept eine Card (Portionen, ×Faktor,
Herkunfts-Menüs, Zutaten); Sheet/CSV.

**Legacy/entfernt in V4.1:** die per-Rezept-Persistenz in `production_batches` (+ Standalone-Seite mit
Status/Termin/Station-`station`) wurde entfernt. Completion-Status liegt jetzt auf **Batch-Ebene**
(`kitchen_batches.status`). Per-Rezept-Timeline/Station ist ein mögliches Folge-Feature auf dem neuen Flow.

## 21. V4.1 — KITCHEN PRODUCTION BATCH (zentrale Eingabe → abgeleitete Outputs)

**Problem (vor V4.1):** Menü+Pax mussten zweimal eingegeben werden (`/kitchen/production` und
`/kitchen/purchasing`). Beide rechneten mit derselben Logik — nur die Eingabe war dupliziert.

**Modell (V4.1):** Eine Eingabe — der **Kitchen Production Batch** — daraus werden Production &
Purchasing **abgeleitet** (nie getrennte Eingaben):
```
Verkaufte Menüs → Production Batch (Menüs + Pax, EINMAL) → Rezeptaggregation
  → Production Output  (/operations/production)
  → Purchasing Output  (/operations/purchasing)
```

**DB (Migration `20260606000003`, additiv):**
`kitchen_batches` (id, name, description, start_date, end_date, production_date, status, timestamps) +
`kitchen_batch_items` (id, batch_id→kitchen_batches CASCADE, menu_id→menus, pax_count, unique(batch_id,menu_id)).
anon/authenticated FULL-CRUD. **Namens-Hinweis:** das alte per-Rezept `production_batches` (+ `purchasing_lists`)
bleibt als **Legacy** in der DB (nicht gedroppt), wird vom neuen Flow aber nicht genutzt.

**Gemeinsamer Aggregation-Service (Kernforderung erfüllt):**
`lib/operations/computeBatchOutputs.ts#computeBatchOutputs(rows, units, supplierProducts, base=50)`
füttert DIESELBEN `(menu,pax)`-Zeilen an **beide** bestehenden Funktionen
`buildProductionPlan` (Production) und `aggregatePurchasing` (Purchasing). → eine Datenbasis, zwei
Outputs; sie können nicht auseinanderlaufen. `services/batch.service.ts#getOutputs(batchId)` lädt
Batch-Items + Deep-Embed-Menüs (`getMenusForCalc`, jetzt inkl. `ingredients.category`) + supplier_products
+ units und ruft den Service.

**UI (Nav-Gruppe „Operations"):**
- `/operations/batches` (Liste) + `/operations/batches/[id]` = **die einzige Dateneingabe** (Menü + Pax).
- `/operations/production` — Batch-Auswahl → Production Output (je Rezept, skaliert; Prep-Zutaten) +
  Print **„Kitchen Production Sheet"** + CSV.
- `/operations/purchasing` — Batch-Auswahl → Purchasing Output **gruppiert nach Kategorie**
  (`ingredient.category`), Einheiten-Merge + Print **„Purchasing Sheet"** + CSV.
- Basis-Portion fix bei 50 (server-seitig in `computeBatchOutputs`), damit Production & Purchasing
  identisch skalieren (yield → production_notes → 50).

**Entfernt (keine Altlasten):** `app/(admin)/kitchen/*`, `hooks/use-purchasing.ts`, `hooks/use-production.ts`,
`services/production.service.ts`. **Behalten/wiederverwendet:** `lib/purchasing/aggregate.ts`,
`lib/production/plan.ts`, `purchasingService.getMenusForCalc/getSupplierProducts`.

**Grenzen:** Aggregate werden live berechnet (keine `*_calculations`-Tabellen — deterministisch
ableitbar, kein Stale-Risk). Lieferanten/Kosten weiter datenabhängig (`supplier_products` leer).

---

*Diese Datei ist ab V4 die maßgebliche Referenz. Bei Konflikt: Live-DB (Abschnitt 4.2) gewinnt.*
*Letzte Aktualisierung: 2026-06-06 — V4.1 Batch-Workflow (§21): zentrale Eingabe + gemeinsamer
Aggregation-Service; Standalone-Rechner entfernt. Migration `20260606000003`.*
