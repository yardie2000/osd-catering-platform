// Confirm the E5 de-dup: dropped ingredients gone, canonical lines now carry the
// merged demand, no orphan English names left. Read-only (anon) + real engine.
//   node --import ./tests/register.mjs audit/verify_dedup.mjs
import { readFileSync } from 'node:fs'
import { aggregatePurchasing, DEFAULT_CALC_CONFIG } from '../lib/purchasing/aggregate'

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const BATCH = 'f7c3b24d-d6ec-48e8-b128-0f2a1e187a44'
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }
const fmt = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)

// 1. dropped codes gone?
const droppedCodes = ['ING-0115', 'ING-0167', 'ING-0101', 'ING-0169', 'ING-0138', 'ING-0147', 'ING-0148', 'ING-0112', 'ING-0168']
const ingsLeft = await get(`ingredients?select=ingredient_code,name&ingredient_code=in.(${droppedCodes.join(',')})`)
console.log(`ingredients total now : ${(await get('ingredients?select=ingredient_code')).length} (was 169)`)
console.log(`dropped codes still present : ${ingsLeft.length === 0 ? 'NONE ✅' : ingsLeft.map((i) => i.ingredient_code).join(', ') + ' ❌'}\n`)

// 2. run engine on the live batch
const items = await get(`kitchen_batch_items?batch_id=eq.${BATCH}&select=menu_id,pax_count`)
const menuIds = [...new Set(items.map((i) => i.menu_id))]
const sel = `id,menu_code,menu_name,menu_items(id,name,recipe_id,recipe:recipes(id,recipe_code,name,yield_quantity,production_notes,production_loss_pct,yield_pct,recipe_ingredients(id,quantity,ingredient_id,unit_id,ingredient:ingredients(id,ingredient_code,name,category),unit:units!recipe_ingredients_unit_id_fkey(id,unit_code,name,short_name))))`
const menus = await get(`menus?id=in.(${menuIds.join(',')})&select=${encodeURIComponent(sel)}`)
const units = await get('units?select=id,unit_code,name,short_name')
const byId = new Map(menus.map((m) => [m.id, m]))
const rows = items.map((i) => ({ menu: byId.get(i.menu_id), count: i.pax_count })).filter((r) => r.menu && r.count > 0)
const buy = aggregatePurchasing(rows, [], DEFAULT_CALC_CONFIG, units)

const orphan = buy.lines.filter((l) => ['Salt', 'H2O', 'Olive Oil', 'Lemon Juice', 'Mustard', 'Egg Yolk', 'sugar', 'SALT 2 g Cashew praline', 'water (on500 gr Cashew)'].includes(l.ingredient_name))
console.log(`orphan English/duplicate lines in purchasing : ${orphan.length === 0 ? 'NONE ✅' : orphan.map((l) => l.ingredient_name).join(', ') + ' ❌'}`)
console.log(`total purchasing lines : ${buy.lines.length}\n`)

console.log('canonical lines (merged demand):')
for (const name of ['Salz', 'Wasser', 'Olivenöl', 'Zitronensaft', 'Senf', 'Eigelb']) {
  const ls = buy.lines.filter((l) => l.ingredient_name === name)
  if (!ls.length) { console.log(`  ${name}: (none)`); continue }
  console.log(`  ${name.padEnd(13)} ${ls.map((l) => `${fmt(l.quantity)} ${l.unit_label}${l.unit_class === 'qualitative' ? ' (n.Bedarf)' : ''}`).join('  +  ')}`)
}
