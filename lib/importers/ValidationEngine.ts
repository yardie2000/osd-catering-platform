import { z } from 'zod'
import type { ValidationError } from '@/types'

// ── German number parser ──────────────────────────────────
// Handles: "200" → 200, "1.000" → 1000, "1,5" → 1.5, "1.000,5" → 1000.5
export function parseGermanNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return isNaN(value) ? null : value
  const s = String(value).trim()
  if (s.includes('.') && s.includes(',')) {
    const cleaned = s.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(cleaned)
    return isNaN(n) ? null : n
  }
  if (s.includes(',')) {
    const n = parseFloat(s.replace(',', '.'))
    return isNaN(n) ? null : n
  }
  if (s.includes('.')) {
    const parts = s.split('.')
    if (parts[parts.length - 1].length === 3) {
      const n = parseFloat(s.replace(/\./g, ''))
      return isNaN(n) ? null : n
    }
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

// ── Parse yield string e.g. "50 Portionen" → { quantity: 50 } ─────────────
// yield_quantity is a PORTION BASE (the scaling denominator), so a number is
// only accepted when the text actually expresses portions/servings. Yields
// stated in mass/volume ("Ca. 400 g Kräutersoße", "180–220 ml") or as free
// text ("Ausbeute Hähnchen Portionen 1 4 5 …", a table) must NOT be read as a
// portion count — they return quantity:null and keep the raw text as notes.
export function parseYieldString(value: unknown): { quantity: number | null; notes: string | null } {
  if (value == null || value === '') return { quantity: null, notes: null }
  const s = String(value).trim()
  // "<n> [–<m>] Portion(en)/Portion/Stk Portionen/Pers/Servings" — n is the base.
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:[–-]\s*(\d+(?:[.,]\d+)?)\s*)?(?:portion|portionen|pers|personen|servings?|stk\.?\s*portion)/i)
  if (m) {
    const a = parseGermanNumber(m[1])
    const b = m[2] != null ? parseGermanNumber(m[2]) : null
    const quantity = a != null && b != null ? Math.round((a + b) / 2) : a
    return { quantity: quantity && quantity > 0 ? quantity : null, notes: s }
  }
  // No portion count detectable → keep the raw text for reference, no base.
  return { quantity: null, notes: s }
}

// ── Numeric coercer with German format support ────────────
const germanNumeric = z.union([z.number(), z.string(), z.null()]).optional()
  .transform((v) => {
    if (v == null || v === '') return null
    return parseGermanNumber(v)
  })

// ── Schemas matching the actual Excel columns ─────────────

export const unitRowSchema = z.object({
  unit_id:   z.coerce.number().int().positive(),
  unit_name: z.string().min(1, 'unit_name is required'),
})

export const ingredientRowSchema = z.object({
  ingredient_id:   z.coerce.number().int().positive(),
  ingredient_name: z.string().min(1, 'ingredient_name is required'),
})

export const recipeRowSchema = z.object({
  recipe_id:    z.coerce.number().int().positive(),
  component_id: z.string().optional().nullable(),
  recipe_name:  z.string().min(1, 'recipe_name is required'),
  preparation:  z.string().optional().nullable(),
  yield:        z.string().optional().nullable(),
  critical_note:z.string().optional().nullable(),
  shelf_life:   z.string().optional().nullable(),
  usage:        z.string().optional().nullable(),
  comment:      z.string().optional().nullable(),
})

export const recipeIngredientRowSchema = z.object({
  recipe_ingredient_id: z.coerce.number().int().positive(),
  recipe_id:            z.coerce.number().int().positive(),
  ingredient_id:        z.coerce.number().int().positive(),
  // Quantity may be blank/“nach”/“¼” etc. — accept anything (incl. null);
  // the importer normalises it and defaults unusable values to 1.
  quantity:             z.union([z.string(), z.number()]).nullish(),
  unit_id:              z.coerce.number().int().positive(),
  supplier:             z.string().optional().nullable(),
})

// ── Suppliers sheet (V3) ──────────────────────────────────
// Columns: ingredient_id, supplier_name, package_description,
//          package_quantity, package_unit, minimum_order_quantity,
//          supplier_sku, supplier_pack_price, lead_time_days
export const supplierRowSchema = z.object({
  ingredient_id:          z.coerce.number().int().positive(),
  supplier_name:          z.string().min(1, 'supplier_name is required'),
  package_description:    z.string().optional().nullable(),
  package_quantity:       germanNumeric,
  package_unit:           z.string().optional().nullable(),
  minimum_order_quantity: germanNumeric,
  supplier_sku:           z.string().optional().nullable(),
  supplier_pack_price:    germanNumeric,
  lead_time_days:         z.coerce.number().int().nonnegative().optional().nullable(),
})

// ── Menus sheet (V3) ─────────────────────────────────────
// Columns: menu_code, menu_name, menu_description, category, price_per_person
export const menuRowSchemaV3 = z.object({
  menu_code:       z.string().min(1, 'menu_code is required'),
  menu_name:       z.string().min(1, 'menu_name is required'),
  menu_description:z.string().optional().nullable(),
  category:        z.string().optional().nullable(),
  price_per_person: germanNumeric,
  active:          z.union([z.boolean(), z.string()]).transform((v) => {
    if (typeof v === 'boolean') return v
    return !['false', '0', 'nein', 'no'].includes(String(v).toLowerCase())
  }).optional().default(true),
})

// ── Menu Items sheet (V4 — live schema) ───────────────────
// Standalone menu line items, each with an OPTIONAL recipe link.
// Columns: menu_code, name, description, dietary, allergens,
//          item_price, sort_order, recipe_code (optional)
// recipe_code: links the line to a recipe (by recipe_code) when present;
//              otherwise the importer falls back to an exact-unique name
//              match, and leaves the line unlinked when neither resolves.
// allergens: comma/semicolon-separated string (or array) → string[]
export const menuItemRowSchema = z.object({
  menu_code:   z.string().min(1, 'menu_code is required'),
  name:        z.string().min(1, 'name is required'),
  recipe_code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dietary:     z.string().optional().nullable(),
  allergens:   z.union([z.string(), z.array(z.string())]).nullish().transform((v) => {
    if (v == null) return [] as string[]
    const arr = Array.isArray(v) ? v : String(v).split(/[,;]/)
    return arr.map((s) => s.trim()).filter(Boolean)
  }),
  item_price:  germanNumeric,
  sort_order:  z.coerce.number().int().nonnegative().optional().default(0),
})

// ── allergens coercer (comma/semicolon string OR array → string[]) ──────────
const allergenList = z.union([z.string(), z.array(z.string())]).nullish().transform((v) => {
  if (v == null) return [] as string[]
  const arr = Array.isArray(v) ? v : String(v).split(/[,;]/)
  return arr.map((s) => s.trim()).filter(Boolean)
})

// ── positions sheet (V5 — geteilter Katalog) ──────────────
// Stammdaten einer Position; position_code ist der stabile Matching-Schlüssel.
// Columns: position_code, name, description, dietary, allergens, default_price
export const positionRowSchema = z.object({
  position_code: z.string().min(1, 'position_code is required'),
  name:          z.string().min(1, 'name is required'),
  description:   z.string().optional().nullable(),
  dietary:       z.string().optional().nullable(),
  allergens:     allergenList,
  default_price: germanNumeric,
})

// ── menu_positions sheet (V5) ─────────────────────────────
// Zuordnung Menü ↔ Position; beide über ihre Codes referenziert.
// Columns: menu_code, position_code, sort_order, price_override
export const menuPositionRowSchema = z.object({
  menu_code:      z.string().min(1, 'menu_code is required'),
  position_code:  z.string().min(1, 'position_code is required'),
  sort_order:     z.coerce.number().int().nonnegative().optional().default(0),
  price_override: germanNumeric,
})

// ── position_components sheet (V5) ────────────────────────
// Bestandteile einer Position (analog menu_item_components, auf position_code bezogen).
// Genau eines von recipe_code / ingredient_code muss gesetzt sein (im Importer geprüft).
// Columns: position_code, recipe_code, ingredient_code, quantity, unit_code, sort_order
export const positionComponentRowSchema = z.object({
  position_code:   z.string().min(1, 'position_code is required'),
  recipe_code:     z.string().optional().nullable(),
  ingredient_code: z.string().optional().nullable(),
  quantity:        germanNumeric,
  unit_code:       z.string().optional().nullable(),
  sort_order:      z.coerce.number().int().nonnegative().optional().default(0),
})

type AnySchema = z.ZodTypeAny

export function validateRows<T>(
  rows: unknown[],
  schema: AnySchema,
  sheet: string
): { valid: T[]; errors: ValidationError[] } {
  const valid: T[] = []
  const errors: ValidationError[] = []

  rows.forEach((row, index) => {
    const result = schema.safeParse(row)
    if (result.success) {
      valid.push(result.data as T)
    } else {
      result.error.issues.forEach((issue) => {
        errors.push({
          row: index + 3, // +3: row 1=title, row 2=blank, row 3=headers
          sheet,
          field: issue.path.join('.'),
          value: (row as Record<string, unknown>)[issue.path[0] as string],
          message: issue.message,
        })
      })
    }
  })

  return { valid, errors }
}
