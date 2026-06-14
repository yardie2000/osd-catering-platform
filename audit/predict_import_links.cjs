// Predict the menu→recipe link impact of re-importing the corrected workbook,
// WITHOUT writing anything. Reproduces MenuItemImporter.resolveRecipeId:
//   recipe_code (none in this sheet) → else exact-UNIQUE recipe name → else null.
// Compares the would-be link count to the CURRENT live link count (anon reads).
const XLSX = require('xlsx')
const { readFileSync } = require('node:fs')

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const FILE = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }

async function main() {
  // live recipes + current links
  const recipes = await get('recipes?select=id,recipe_code,name')
  const liveItems = await get('menu_items?select=name,recipe_id')
  const currentLinked = liveItems.filter((i) => i.recipe_id).length

  // recipe name → unique id (only when unique), per importer logic
  const nameToIds = new Map()
  for (const r of recipes) {
    const k = (r.name || '').trim().toLowerCase()
    nameToIds.set(k, [...(nameToIds.get(k) ?? []), r.id])
  }

  // Excel menu_items (header row 1 → range 0)
  const wb = XLSX.readFile(FILE)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['menu_items'], { defval: null, range: 0 })
  const hasRecipeCodeCol = rows.length > 0 && 'recipe_code' in rows[0]

  let wouldLink = 0
  for (const row of rows) {
    const code = row.recipe_code ? String(row.recipe_code).trim().toLowerCase() : null
    if (code) { /* none in this sheet */ continue }
    const byName = nameToIds.get(String(row.name || '').trim().toLowerCase())
    if (byName && byName.length === 1) wouldLink++
  }

  console.log('═══ Predicted menu→recipe link impact of a full re-import ═══\n')
  console.log(`Excel menu_items rows           : ${rows.length}`)
  console.log(`Excel has recipe_code column    : ${hasRecipeCodeCol ? 'YES' : 'NO  ← links rely on name match only'}`)
  console.log(`live menu_items                 : ${liveItems.length}`)
  console.log(`CURRENT links (recipe_id set)   : ${currentLinked}`)
  console.log(`links AFTER full re-import      : ${wouldLink}   (exact-unique name matches)`)
  const delta = wouldLink - currentLinked
  console.log(`\n→ net change                    : ${delta >= 0 ? '+' : ''}${delta} links` +
    (delta < 0 ? `  ⚠️  REGRESSION — full import would BREAK ${-delta} links` : ''))
}
main().catch((e) => console.log('error:', e.message))
