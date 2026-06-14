// End-to-end check: run the REAL V4.2 engine against the LIVE juni batch.
// Read-only, anon key (same access the browser app uses). Confirms the new
// recipes.production_loss_pct / yield_pct columns flow through the deep embed
// and that production/purchasing now apply the loss/yield stages.
//   node --import ./tests/register.mjs audit/live_engine_check.mjs
import { readFileSync } from 'node:fs'
import { buildProductionPlan } from '../lib/production/plan'
import { aggregatePurchasing, DEFAULT_CALC_CONFIG } from '../lib/purchasing/aggregate'

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const BATCH = 'f7c3b24d-d6ec-48e8-b128-0f2a1e187a44' // "juni" (from the export URLs)
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (path) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}
const fmt = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)

const items = await get(`kitchen_batch_items?batch_id=eq.${BATCH}&select=menu_id,pax_count`)
const menuIds = [...new Set(items.map((i) => i.menu_id))]
const sel = `id,menu_code,menu_name,menu_items(id,name,recipe_id,recipe:recipes(id,recipe_code,name,yield_quantity,production_notes,production_loss_pct,yield_pct,recipe_ingredients(id,quantity,ingredient_id,unit_id,ingredient:ingredients(id,ingredient_code,name,category),unit:units!recipe_ingredients_unit_id_fkey(id,unit_code,name,short_name))))`
const menus = await get(`menus?id=in.(${menuIds.join(',')})&select=${encodeURIComponent(sel)}`)
const units = await get(`units?select=id,unit_code,name,short_name`)
const byId = new Map(menus.map((m) => [m.id, m]))
const rows = items.map((i) => ({ menu: byId.get(i.menu_id), count: i.pax_count })).filter((r) => r.menu && r.count > 0)

console.log(`juni batch: ${rows.length} menu rows · ${rows.reduce((s, r) => s + r.count, 0)} pax`)
console.log(`config: loss ${DEFAULT_CALC_CONFIG.productionLossPct}% · yield ${DEFAULT_CALC_CONFIG.yieldPct}%\n`)

const plan = buildProductionPlan(rows, DEFAULT_CALC_CONFIG)
const buy = aggregatePurchasing(rows, [], DEFAULT_CALC_CONFIG, units)

const alioli = plan.batches.find((b) => b.recipe_code === 'REC-0022')
if (alioli) {
  const egg = alioli.ingredients.find((i) => i.ingredient_name === 'Egg Yolk')
  console.log(`Production · Alioli ×${fmt(alioli.batch_factor)} (${alioli.portions_needed} Pt, loss ${alioli.production_loss_pct}%)`)
  if (egg) console.log(`   Egg Yolk: required ${fmt(egg.required_quantity)} → production ${fmt(egg.quantity)} ${egg.unit_label}\n`)
}

console.log('Purchasing (physical) — required → production → purchasing:')
let okPhysical = 0, badPhysical = 0
for (const l of buy.lines) {
  if (l.unit_class !== 'mass' && l.unit_class !== 'volume') continue
  const ratio = l.quantity / l.production_quantity
  const prodRatio = l.production_quantity / l.required_quantity
  if (Math.abs(ratio - 1 / 0.8) < 1e-6 && Math.abs(prodRatio - 1.1) < 1e-6) okPhysical++; else badPhysical++
}
for (const name of ['Auberginen', 'Salt', 'Raps Oil', 'Flour 405']) {
  const l = buy.lines.find((x) => x.ingredient_name === name)
  if (l) console.log(`   ${name.padEnd(14)} ${fmt(l.required_quantity).padStart(10)} → ${fmt(l.production_quantity).padStart(10)} → ${fmt(l.quantity).padStart(10)} ${l.unit_label}`)
}
const qualitative = buy.lines.filter((l) => l.unit_class === 'qualitative')
console.log(`\nphysical lines obeying production=req×1.1 & purchasing=prod÷0.8 : ${okPhysical} ok, ${badPhysical} bad`)
console.log(`qualitative lines (render as "n. Bedarf")                       : ${qualitative.length}`)
console.log(`assumed-base recipes (no yield → default 50)                    : ${plan.assumptions.length}`)
