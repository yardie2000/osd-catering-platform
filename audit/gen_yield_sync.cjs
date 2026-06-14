// SAFE yield sync — STRICT: only set recipes.yield_quantity when the text
// explicitly states "<n> [–<m>] Portionen" (in the yield column or note).
// Excludes mass/volume yields, "noch festzulegen", "1 Liter…", bare tables.
// Cross-checks live values (anon read); only emits SQL where live differs.
// Prints full evidence. Writes audit/yield_sync.sql.
const XLSX = require('xlsx')
const { readFileSync, writeFileSync } = require('node:fs')

const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const FILE = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }

// STRICT: a number (or range) immediately followed by the word "Portionen".
function strictPortions(text) {
  if (!text) return null
  const m = String(text).match(/(\d+)\s*(?:[–-]\s*(\d+)\s*)?Portionen/i)
  if (!m) return null
  const a = parseInt(m[1], 10); if (!a || a <= 0) return null
  const b = m[2] ? parseInt(m[2], 10) : null
  return b && b > 0 ? Math.round((a + b) / 2) : a
}

async function main() {
  const rec = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets['recipes'], { header: 1, defval: '' }).slice(3)
  const live = await get('recipes?select=recipe_code,yield_quantity')
  const liveByCode = new Map(live.map((r) => [r.recipe_code, r.yield_quantity == null ? null : Number(r.yield_quantity)]))

  const accepted = [], rejected = []
  for (const r of rec) {
    const code = String(r[1]).trim(); if (!code) continue
    const yieldTxt = String(r[4]).trim(), note = String(r[5]).trim()
    // Exclude recipes that explicitly declare the base undefined.
    if (/noch\s*festzulegen/i.test(note)) { rejected.push({ code, yieldTxt: yieldTxt || '(Portionsbasis: noch festzulegen)', note }); continue }
    const base = strictPortions(yieldTxt) ?? strictPortions(note)
    const src = strictPortions(yieldTxt) != null ? `yield="${yieldTxt}"` : (base != null ? 'note' : null)
    if (base == null) {
      if (yieldTxt || /Portionsbasis/i.test(note)) rejected.push({ code, yieldTxt, note })
      continue
    }
    if (!liveByCode.has(code)) continue
    accepted.push({ code, base, live: liveByCode.get(code), src })
  }

  const changes = accepted.filter((a) => a.live !== a.base)
  console.log('═══ STRICT yield sync (only explicit "N Portionen") ═══\n')
  console.log('ACCEPTED (would set yield_quantity):')
  for (const a of accepted) {
    const tag = a.live !== a.base ? `CHANGE ${a.live ?? 'NULL'}→${a.base}` : `(no-op, already ${a.base})`
    console.log(`  ${a.code.padEnd(9)} base ${String(a.base).padStart(3)}  ${tag}`)
  }
  console.log(`\nREJECTED (no explicit portion base — left for manual review): ${rejected.length}`)
  for (const x of rejected.slice(0, 30)) console.log(`  ${x.code.padEnd(9)} yield="${x.yieldTxt.slice(0,40)}"`)

  const sql = [
    '-- V4.2 STRICT yield sync — only recipes whose text explicitly says "N Portionen".',
    '-- Touches ONLY recipes.yield_quantity. Never touches menu_items / links / ingredients.',
    '',
    ...changes.map((c) => `update public.recipes set yield_quantity = ${c.base} where recipe_code = '${c.code}';  -- ${c.live ?? 'NULL'} → ${c.base}`),
    '',
    "notify pgrst, 'reload schema';",
  ].join('\n')
  writeFileSync(`${ROOT}/audit/yield_sync.sql`, sql)

  // Rollback: restore the exact prior values (NULL or number).
  const rollback = [
    '-- Rollback for yield_sync.sql — restores prior recipes.yield_quantity values.',
    '',
    ...changes.map((c) => `update public.recipes set yield_quantity = ${c.live == null ? 'NULL' : c.live} where recipe_code = '${c.code}';`),
    '',
    "notify pgrst, 'reload schema';",
  ].join('\n')
  writeFileSync(`${ROOT}/audit/yield_rollback.sql`, rollback)
  console.log(`\nrows that CHANGE: ${changes.length} → audit/yield_sync.sql (+ yield_rollback.sql)`)
}
main().catch((e) => console.log('error:', e.message))
