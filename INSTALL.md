# OSD Catering Platform V4.2 — Installation & Deployment Guide

## Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase project (create at supabase.com)

---

## 1. Setup Environment

Copy the example env file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Run Database Migrations

In your Supabase dashboard:
- Go to **SQL Editor**
- Execute in order:
  1. `supabase/migrations/20260601000001_v2_schema.sql`
  2. `supabase/migrations/20260601000002_v3_additions.sql`

Or using the Supabase CLI:

```bash
supabase db push
```

This creates all tables, indexes, RLS policies, and future module stubs.

---

## 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 5. Import Master Data from Excel

1. Go to **Operations → Import Center**
2. Toggle **Dry Run** on for a safe preview
3. Upload `OSD_Rezeptdatenbank_normalisiert.xlsx`
4. Review the import preview and log
5. Toggle **Dry Run** off and re-upload to commit

The Excel workbook must contain these sheet names (case-insensitive):
- `units` — unit master data
- `ingredients` — ingredient master data
- `recipes` — recipe master data
- `recipe_ingredients` — ingredient lines per recipe
- `menus` *(optional)* — menu master data (V3: columns `menu_id`, `menu_name`, `menu_category`, `price_per_person_net`, `service_note`)
- `menu_items` *(optional)* — recipe assignments per menu (V3: columns `menu_item_id`, `menu_id`, `matched_recipe_componentid`, `component_display_name`, `course`)

---

## 6. Production Build

```bash
npm run build
npm start
```

---

## Database Schema Overview

```
units
  └── ingredients (default_unit_id → units)
  └── recipes (yield_unit_id → units)
      └── recipe_ingredients
              ├── recipe_id → recipes
              ├── ingredient_id → ingredients
              └── unit_id → units
menus
  └── menu_recipes
          ├── menu_id → menus
          ├── recipe_id → recipes
          └── portion_unit_id → units
import_jobs
  └── data_import_log
```

**Future module tables (scaffolded, not yet active):**
- `events`, `event_menus`
- `suppliers`
- `purchasing_lists`, `purchasing_list_items`
- `production_batches`

---

## V1 → V2 Migration Strategy

V1 used `menus`, `menu_items`, and `addons`.
V2 replaces this with `menus`, `recipes`, `ingredients`, and `units`.

**Migration steps:**
1. Deploy V2 alongside V1 (different directory, different port)
2. Run the V2 migration SQL on the same Supabase project (new tables, no conflict)
3. Use the Import Center to load master data from the Excel workbook
4. Verify data in V2 via Validation and Data Quality pages
5. Decommission V1 once V2 is verified

V1 tables remain untouched. V2 schema is fully additive.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, TailwindCSS, shadcn/ui |
| State | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Database | PostgreSQL via Supabase |
| Auth | Supabase RLS (authenticated / anon) |
| Import | xlsx + custom engine |
| Types | TypeScript strict |
