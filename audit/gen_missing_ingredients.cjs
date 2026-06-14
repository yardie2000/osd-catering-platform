// List every recipe that has ZERO recipe_ingredients (so it scales to nothing in
// production/purchasing). Includes any prose hint (preparation / production_notes
// / description) so whoever fills it has a starting point. Flags juni-batch ones.
//   node audit/gen_missing_ingredients.cjs
const XLSX = require('xlsx')
const { readFileSync } = require('node:fs')

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const OUT = 'D:/Downloads/files/output/OSD_Fehlende_Zutaten.xlsx'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const BATCH = 'f7c3b24d-d6ec-48e8-b128-0f2a1e187a44'
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }
const clip = (s, n = 180) => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t }

async function main() {
  const recipes = await get('recipes?select=recipe_code,name,preparation,production_notes,description,recipe_ingredients(id)&order=recipe_code')
  const items = await get(`kitchen_batch_items?batch_id=eq.${BATCH}&select=menu_id`)
  const menuIds = [...new Set(items.map((i) => i.menu_id))]
  const menus = await get(`menus?id=in.(${menuIds.join(',')})&select=menu_items(recipe:recipes(recipe_code))`)
  const batchCodes = new Set()
  for (const m of menus) for (const mi of m.menu_items || []) if (mi.recipe?.recipe_code) batchCodes.add(mi.recipe.recipe_code)

  const empty = recipes.filter((r) => (r.recipe_ingredients || []).length === 0)
  const rows = empty.map((r) => ({
    'Prio': batchCodes.has(r.recipe_code) ? '★ juni' : '',
    'Code': r.recipe_code,
    'Rezept': r.name,
    'Hinweis (Zubereitung / Notiz / Beschreibung)': clip(r.preparation || r.production_notes || r.description),
    'ZUTATEN ERFASSEN ⟵ z. B. in der App (Recipes → Edit)': '',
  }))
  rows.sort((a, b) => (a.Prio ? 0 : 1) - (b.Prio ? 0 : 1) || a.Code.localeCompare(b.Code))

  const help = [
    ['OSD — Rezepte ohne hinterlegte Zutaten (V4.2)'],
    [''],
    ['Diese Rezepte haben KEINE Zutaten in der Datenbank. Sie erscheinen in Production/Purchasing'],
    ['als „keine Zutaten" und tragen NICHTS zur Einkaufs-/Produktionsmenge bei.'],
    [''],
    ['Zutaten am besten direkt in der App erfassen: Recipes → Rezept öffnen → Edit → Zutaten.'],
    ['(Alternativ über das Import Center mit einem recipe_ingredients-Sheet.)'],
    [''],
    ['★ juni = wird im aktuellen Batch produziert (zuerst erfassen).'],
    ['Die Hinweis-Spalte zeigt vorhandenen Zubereitungs-/Notiztext als Starthilfe.'],
  ].map((r) => [r[0]])

  const wb = XLSX.utils.book_new()
  const wsHelp = XLSX.utils.aoa_to_sheet(help); wsHelp['!cols'] = [{ wch: 95 }]
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Anleitung')
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 7 }, { wch: 9 }, { wch: 40 }, { wch: 70 }, { wch: 48 }]
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, 'Fehlende Zutaten')
  XLSX.writeFile(wb, OUT)

  console.log(`recipes total                 : ${recipes.length}`)
  console.log(`recipes with NO ingredients   : ${empty.length}`)
  console.log(`  ★ in juni batch (priority)  : ${rows.filter((r) => r.Prio).length}`)
  console.log(`\n→ wrote ${OUT}\n`)
  for (const r of rows.filter((x) => x.Prio)) console.log(`  ★ ${r.Code.padEnd(9)} ${r.Rezept}`)
  const others = rows.filter((x) => !x.Prio)
  if (others.length) { console.log(`  … and ${others.length} more:`); for (const r of others) console.log(`    ${r.Code.padEnd(9)} ${r.Rezept}`) }
}
main().catch((e) => console.log('error:', e.message))
