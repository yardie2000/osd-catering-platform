import type { ReactNode } from 'react'
import type { RecipeWithDetails } from '@/types'

/* ─────────────────────────────────────────────────────────────────────────
   Recipe Review print document (Hybrid layout): cover → index → per-recipe
   review blocks. Presentational only — receives already-loaded recipe data.
   All labels are English; recipe/ingredient names stay as stored in the DB.
   ───────────────────────────────────────────────────────────────────────── */

// Empty write-in rows appended to every ingredient table so the chef can add
// missing ingredients by hand during the review.
const BLANK_INGREDIENT_ROWS = 3

// Fixed EU-14 controlled-vocabulary lookup (German → English). NOT free-text
// translation — falls back to the raw stored value for anything unknown.
const ALLERGEN_EN: Record<string, string> = {
  Gluten: 'Gluten',
  Krebstiere: 'Crustaceans',
  Eier: 'Eggs',
  Fisch: 'Fish',
  Erdnüsse: 'Peanuts',
  Soja: 'Soy',
  Milch: 'Milk',
  Schalenfrüchte: 'Nuts',
  Sellerie: 'Celery',
  Senf: 'Mustard',
  Sesam: 'Sesame',
  Sulfite: 'Sulphites',
  Lupinen: 'Lupin',
  Weichtiere: 'Molluscs',
}

function fmt(value: number | null | undefined, decimals = 2): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value)
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

function unitLabel(unit: { short_name: string | null; name: string } | null): string {
  if (!unit) return ''
  return unit.short_name || unit.name || ''
}

function recipeAllergens(recipe: RecipeWithDetails): string[] {
  const set = new Set<string>()
  for (const ri of recipe.recipe_ingredients) {
    for (const a of ri.ingredient?.allergens ?? []) {
      set.add(ALLERGEN_EN[a] ?? a)
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

// Detect missing / incomplete data so the chef can triage each recipe.
function missingFields(recipe: RecipeWithDetails): string[] {
  const missing: string[] = []
  if (recipe.base_portions == null) missing.push('base portions')
  if (recipe.yield_quantity == null) missing.push('yield')
  else if (!recipe.yield_unit) missing.push('yield unit')
  if (recipe.production_loss_pct == null) missing.push('production loss %')
  if (recipe.yield_pct == null) missing.push('yield %')
  if (isBlank(recipe.shelf_life)) missing.push('shelf life')
  if (recipe.recipe_ingredients.length === 0) missing.push('ingredients')
  if (isBlank(recipe.preparation)) missing.push('preparation')
  return missing
}

function yieldText(recipe: RecipeWithDetails): string {
  if (recipe.yield_quantity == null) return '—'
  const u = unitLabel(recipe.yield_unit)
  return `${fmt(recipe.yield_quantity, 3)}${u ? ` ${u}` : ''}`
}

// ── Small building blocks ──────────────────────────────────────────────────

function Field({
  label,
  value,
  blank,
  wide,
}: {
  label: string
  value?: ReactNode
  blank?: boolean
  wide?: boolean
}) {
  return (
    <div className={`rr-field${wide ? ' rr-field-wide' : ''}`}>
      <div className="rr-field-label">{label}</div>
      <div className={`rr-field-value${blank ? ' rr-field-blank' : ''}`}>
        {blank ? <span className="rr-blankline" /> : value}
      </div>
    </div>
  )
}

function ProseBlock({ label, text }: { label: string; text: string | null }) {
  if (isBlank(text)) return null
  return (
    <div className="rr-prose-block">
      <div className="rr-prose-label">{label}</div>
      <div className="rr-prose-text">{text}</div>
    </div>
  )
}

function CorrectionArea() {
  const checks = [
    'Portions OK?',
    'Yield OK?',
    'Quantities OK?',
    'Ingredients complete?',
    'Shelf life OK?',
    'Storage OK?',
  ]
  return (
    <div className="rr-correction">
      <div className="rr-correction-title">Chef review</div>
      <div className="rr-checks">
        {checks.map((c) => (
          <span className="rr-check" key={c}>
            {c}
            <span className="rr-box" /> yes
            <span className="rr-box" /> no
          </span>
        ))}
      </div>
      <div className="rr-corr-notes">
        Notes / corrections:
        <div className="rr-corr-fill" />
        <div className="rr-corr-fill" />
      </div>
      <div className="rr-corr-foot">
        <div className="rr-sig">
          Checked by:
          <div className="rr-sig-line" />
        </div>
        <div className="rr-sig">
          Date:
          <div className="rr-sig-line" />
        </div>
      </div>
    </div>
  )
}

// ── Recipe block ────────────────────────────────────────────────────────────

function RecipeBlock({ recipe, index }: { recipe: RecipeWithDetails; index: number }) {
  const allergens = recipeAllergens(recipe)
  const missing = missingFields(recipe)
  const flaggedInSystem = recipe.needs_review || recipe.recipe_status === 'incomplete'

  return (
    <section className="rr-recipe">
      <div className="rr-recipe-head">
        <h3 className="rr-recipe-name">
          <span className="rr-recipe-index-no">{index}. </span>
          {recipe.name}
        </h3>
        <span className="rr-recipe-code">{recipe.recipe_code}</span>
      </div>

      {(missing.length > 0 || flaggedInSystem) && (
        <div className="rr-attention">
          <b>Needs attention:</b>{' '}
          {[
            ...(flaggedInSystem ? ['marked incomplete in system'] : []),
            ...(missing.length > 0 ? [`missing ${missing.join(', ')}`] : []),
          ].join(' · ')}
        </div>
      )}

      <div className="rr-meta-grid">
        <Field label="Category" blank />
        <Field label="Base portions" value={fmt(recipe.base_portions, 3)} />
        <Field label="Yield / output" value={yieldText(recipe)} />
        <Field label="Scalable" value={recipe.scalable ? 'Yes' : 'No'} />
        <Field
          label="Production loss %"
          value={recipe.production_loss_pct != null ? `${fmt(recipe.production_loss_pct)} %` : '—'}
        />
        <Field
          label="Yield %"
          value={recipe.yield_pct != null ? `${fmt(recipe.yield_pct)} %` : '—'}
        />
        <Field label="Shelf life" value={isBlank(recipe.shelf_life) ? '—' : recipe.shelf_life} />
        <Field label="Storage" blank />
      </div>

      <div className="rr-prose">
        <ProseBlock label="Description" text={recipe.description} />
        <ProseBlock label="Preparation" text={recipe.preparation} />
        <ProseBlock label="Production notes" text={recipe.production_notes} />
        <ProseBlock label="Usage notes" text={recipe.usage_notes} />
      </div>

      <div className="rr-ing-wrap">
        <table className="rr-table rr-ing-table">
          <thead>
            <tr>
              <th className="rr-col-ing">Ingredient</th>
              <th className="rr-col-qty rr-num">Quantity</th>
              <th className="rr-col-unit">Unit</th>
              <th className="rr-col-notes">Notes</th>
              <th className="rr-col-correction">Chef correction</th>
            </tr>
          </thead>
          <tbody>
            {recipe.recipe_ingredients.length === 0 && (
              <tr>
                <td colSpan={5} className="rr-ing-empty">
                  No ingredients recorded — please add below.
                </td>
              </tr>
            )}
            {recipe.recipe_ingredients.map((ri) => (
              <tr key={ri.id}>
                <td>{ri.ingredient?.name ?? '—'}</td>
                <td className="rr-num">{fmt(ri.quantity, 3)}</td>
                <td>{unitLabel(ri.unit) || '—'}</td>
                <td>{isBlank(ri.notes) ? '' : ri.notes}</td>
                <td className="rr-col-correction" />
              </tr>
            ))}
            {Array.from({ length: BLANK_INGREDIENT_ROWS }).map((_, i) => (
              <tr key={`blank-${i}`} className="rr-ing-blank">
                <td />
                <td className="rr-num" />
                <td />
                <td />
                <td className="rr-col-correction" />
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rr-allergen-line">
          <b>Allergens (from ingredients):</b>{' '}
          {allergens.length > 0 ? allergens.join(', ') : 'none derived'}
        </div>
      </div>

      <CorrectionArea />
    </section>
  )
}

// ── Full document ───────────────────────────────────────────────────────────

export function RecipeReviewDocument({
  recipes,
  printDate,
}: {
  recipes: RecipeWithDetails[]
  printDate: string
}) {
  const total = recipes.length

  return (
    <div className="rr-doc">
      {/* Cover */}
      <div className="rr-page rr-break-after">
        <div className="rr-cover">
          <div className="rr-cover-brand">OSD Catering</div>
          <div className="rr-cover-rule" />
          <div className="rr-cover-center">
            <h1 className="rr-cover-title">Recipe Review</h1>
            <div className="rr-cover-sub">Kitchen verification document</div>

            <div className="rr-cover-meta">
              <div className="rr-meta-item">
                <div className="rr-meta-label">Print date</div>
                <div className="rr-meta-value">{printDate}</div>
              </div>
              <div className="rr-meta-item">
                <div className="rr-meta-label">Number of recipes</div>
                <div className="rr-meta-value">{total}</div>
              </div>
            </div>

            <div className="rr-cover-instruction">
              <div className="rr-instr-label">Instructions for the chef</div>
              Please review quantities, base portions, yield, shelf life, preparation notes
              and missing ingredients. Mark any correction directly on the sheet in the
              &ldquo;Chef correction&rdquo; column and the review boxes under each recipe.
            </div>
          </div>
        </div>
      </div>

      {/* Recipe index */}
      <div className="rr-page rr-break-after">
        <h2 className="rr-h2">Recipe index</h2>
        <table className="rr-table rr-index-table">
          <thead>
            <tr>
              <th className="rr-idx-no">No.</th>
              <th>Recipe</th>
              <th>Category</th>
              <th className="rr-num">Base portions</th>
              <th>Yield</th>
              <th className="rr-idx-status">Status</th>
              <th className="rr-idx-notes-col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((recipe, i) => {
              const missing = missingFields(recipe)
              const flagged =
                recipe.needs_review || recipe.recipe_status === 'incomplete'
              const needsReview = missing.length > 0 || flagged
              return (
                <tr key={recipe.id}>
                  <td className="rr-idx-no">{i + 1}</td>
                  <td>{recipe.name}</td>
                  <td className="rr-field-blank" />
                  <td className="rr-num">{fmt(recipe.base_portions, 3)}</td>
                  <td>{yieldText(recipe)}</td>
                  <td className="rr-idx-status">
                    {needsReview ? (
                      <span className="rr-status-warn">Review</span>
                    ) : (
                      <span className="rr-status-ok">OK</span>
                    )}
                  </td>
                  <td />
                </tr>
              )
            })}
            {recipes.length === 0 && (
              <tr>
                <td colSpan={7} className="rr-ing-empty">
                  No recipes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recipe review blocks */}
      <div className="rr-page">
        <h2 className="rr-h2">Recipe review</h2>
        {recipes.map((recipe, i) => (
          <RecipeBlock key={recipe.id} recipe={recipe} index={i + 1} />
        ))}
      </div>
    </div>
  )
}
