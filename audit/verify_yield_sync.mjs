// Confirm the yield sync landed + re-run the real engine on the live juni batch,
// focusing on the two batch-relevant fixes (Caesar SAU-010, Zitrus SAU-011).
//   node --import ./tests/register.mjs audit/verify_yield_sync.mjs
import { readFileSync } from 'node:fs'
import { buildProductionPlan } from '../lib/production/plan'
import { aggregatePurchasing, DEFAULT_CALC_CONFIG } from '../lib/purchasing/aggregate'

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const BATCH = 'f7c3b24d-d6ec-48e8-b128-0f2a1e187a44'
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }
const fmt = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)

// 1. confirm the 11 yields
const EXPECT = { 'SAU-010': 45, 'SAU-011': 175, 'SAU-014': 20, 'SAU-016': 60, 'DIP-004': 60, 'DIP-005': 60, 'PUE-010': 45, 'GEM-007': 55, 'GEM-008': 50, 'GEM-016': 65, 'FRU-002': 50 }
const recs = await get(`recipes?select=recipe_code,yield_quantity&recipe_code=in.(${Object.keys(EXPECT).join(',')})`)
let okY = 0, badY = 0
for (const r of recs) { const want = EXPECT[r.recipe_code]; if (Number(r.yield_quantity) === want) okY++; else { badY++; console.log(`   ✗ ${r.recipe_code}: expected ${want}, got ${r.yield_quantity}`) } }
console.log(`yields confirmed: ${okY}/${Object.keys(EXPECT).length} correct${badY ? `, ${badY} WRONG` : ''}\n`)

// 2. re-run engine on the live batch
const items = await get(`kitchen_batch_items?batch_id=eq.${BATCH}&select=menu_id,pax_count`)
const menuIds = [...new Set(items.map((i) => i.menu_id))]
const sel = `id,menu_code,menu_name,menu_items(id,name,recipe_id,recipe:recipes(id,recipe_code,name,yield_quantity,production_notes,production_loss_pct,yield_pct,recipe_ingredients(id,quantity,ingredient_id,unit_id,ingredient:ingredients(id,ingredient_code,name,category),unit:units!recipe_ingredients_unit_id_fkey(id,unit_code,name,short_name))))`
const menus = await get(`menus?id=in.(${menuIds.join(',')})&select=${encodeURIComponent(sel)}`)
const units = await get('units?select=id,unit_code,name,short_name')
const byId = new Map(menus.map((m) => [m.id, m]))
const rows = items.map((i) => ({ menu: byId.get(i.menu_id), count: i.pax_count })).filter((r) => r.menu && r.count > 0)
const plan = buildProductionPlan(rows, DEFAULT_CALC_CONFIG)

for (const code of ['SAU-010', 'SAU-011']) {
  const b = plan.batches.find((x) => x.recipe_code === code)
  if (!b) { console.log(`${code}: not in batch`); continue }
  console.log(`${b.recipe_name} (${code}) — ${b.portions_needed} Pt ÷ base ${b.base} = ×${fmt(b.batch_factor)} [source: ${b.source}]`)
  for (const ing of b.ingredients.slice(0, 3)) console.log(`   ${ing.ingredient_name.padEnd(14)} req ${fmt(ing.required_quantity)} → prod ${fmt(ing.quantity)} ${ing.unit_label}`)
}
console.log(`\nassumed-base recipes remaining (no yield): ${plan.assumptions.length} (was 20)`)
