// Generate a chef-friendly data-entry workbook for recipes that still lack a
// real portion base (recipes.yield_quantity IS NULL). Pulls live recipes +
// ingredients (anon read), flags those used in the current "juni" batch, and
// adds the workbook's Ausbeute hint + an ingredient preview so a human can
// judge "how many portions does ONE batch yield?". Empty columns to fill.
//   node audit/gen_dataentry_sheet.cjs
const XLSX = require('xlsx')
const { readFileSync } = require('node:fs')

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const OUT = 'D:/Downloads/files/output/OSD_Portionsbasis_Eingabe.xlsx'
const WB = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const BATCH = 'f7c3b24d-d6ec-48e8-b128-0f2a1e187a44'
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }
const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })

function parseBasePortions(notes) {
  if (!notes) return null
  const m = String(notes).match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*Portionen/i)
  if (!m) return null
  const a = parseInt(m[1], 10); if (!a) return null
  const b = m[2] ? parseInt(m[2], 10) : null
  return b ? Math.round((a + b) / 2) : a
}

async function main() {
  // live recipes + ingredients
  const recipes = await get('recipes?select=recipe_code,name,yield_quantity,production_notes,recipe_ingredients(quantity,unit:units(short_name,unit_code),ingredient:ingredients(name))&order=recipe_code')

  // recipe codes used in the juni batch (priority flag)
  const items = await get(`kitchen_batch_items?batch_id=eq.${BATCH}&select=menu_id`)
  const menuIds = [...new Set(items.map((i) => i.menu_id))]
  const menus = await get(`menus?id=in.(${menuIds.join(',')})&select=menu_items(recipe:recipes(recipe_code))`)
  const batchCodes = new Set()
  for (const m of menus) for (const mi of m.menu_items || []) if (mi.recipe?.recipe_code) batchCodes.add(mi.recipe.recipe_code)

  // Ausbeute hint from the corrected workbook (recipes sheet: code col 1, yield col 4)
  const wbRows = XLSX.utils.sheet_to_json(XLSX.readFile(WB).Sheets['recipes'], { header: 1, defval: '' }).slice(3)
  const hintByCode = new Map()
  for (const r of wbRows) { const c = String(r[1]).trim(); if (c) hintByCode.set(c, String(r[4]).trim()) }

  const needsBase = recipes.filter((r) => r.yield_quantity == null)
  const rows = needsBase.map((r) => {
    const notesBase = parseBasePortions(r.production_notes)
    const ings = (r.recipe_ingredients || [])
      .filter((ri) => ri.ingredient)
      .slice(0, 8)
      .map((ri) => `${ri.ingredient.name} ${nf.format(ri.quantity)}${ri.unit?.short_name || ri.unit?.unit_code || ''}`)
      .join(', ')
    return {
      'Prio': batchCodes.has(r.recipe_code) ? '★ juni' : '',
      'Code': r.recipe_code,
      'Rezept': r.name,
      'Aktuelle Basis (Annahme)': notesBase ?? 50,
      'Quelle': notesBase ? 'aus Notiz' : 'Default 50',
      'Hinweis Ausbeute (aus Rezeptbuch)': hintByCode.get(r.recipe_code) || '',
      'Zutaten (Vorschau)': ings || '(keine Zutaten)',
      'PORTIONSBASIS  ⟵ ausfüllen': '',
      'Verlust % (optional)': '',
      'Yield % (optional)': '',
      'Notiz': '',
    }
  })
  // priority first, then by code
  rows.sort((a, b) => (a.Prio ? 0 : 1) - (b.Prio ? 0 : 1) || a.Code.localeCompare(b.Code))

  // ── Anleitung sheet ──
  const help = [
    ['OSD — Portionsbasis erfassen (V4.2)'],
    [''],
    ['Diese Rezepte haben noch keine hinterlegte Portionsbasis. Die App rechnet sie'],
    ['derzeit mit einer Annahme (Default 50 oder aus einer Notiz geschätzt).'],
    [''],
    ['AUSFÜLLEN: Spalte "PORTIONSBASIS" = Wie viele Portionen ergibt EIN Ansatz/Batch'],
    ['dieses Rezepts? (Die Zutaten-Vorschau hilft beim Schätzen.)'],
    [''],
    ['Verlust % / Yield % sind OPTIONAL — leer lassen = globaler Standard (10 % / 80 %).'],
    ['Nur ausfüllen, wenn ein Rezept davon abweicht.'],
    [''],
    ['★ juni = wird im aktuellen Batch produziert (zuerst ausfüllen).'],
    [''],
    ['Zurückgeben → wir erzeugen daraus UPDATE-SQL (recipes.yield_quantity) und spielen es ein.'],
  ].map((r) => [r[0]])

  const wb = XLSX.utils.book_new()
  const wsHelp = XLSX.utils.aoa_to_sheet(help)
  wsHelp['!cols'] = [{ wch: 92 }]
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Anleitung')

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 7 }, { wch: 9 }, { wch: 38 }, { wch: 12 }, { wch: 11 },
    { wch: 40 }, { wch: 60 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 24 },
  ]
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: 10 } }) }
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, ws, 'Portionsbasis')
  XLSX.writeFile(wb, OUT)

  console.log(`recipes total                 : ${recipes.length}`)
  console.log(`recipes WITHOUT a base (yield NULL): ${needsBase.length}`)
  console.log(`  ★ in juni batch (priority)  : ${rows.filter((r) => r.Prio).length}`)
  console.log(`  other                       : ${rows.filter((r) => !r.Prio).length}`)
  console.log(`\n→ wrote ${OUT}`)
  console.log('\nPriority rows:')
  for (const r of rows.filter((x) => x.Prio)) console.log(`  ${r.Code.padEnd(9)} ${r.Rezept}`)
}
main().catch((e) => console.log('error:', e.message))
