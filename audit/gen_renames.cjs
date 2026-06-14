// Generate cosmetic ingredient renames (strip pack-size numbers from names).
// Confirms current names + checks the target name doesn't already exist (would
// create a name-duplicate). Writes audit/renames.sql + audit/renames_rollback.sql.
//   node audit/gen_renames.cjs
const { readFileSync, writeFileSync } = require('node:fs')
const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }

const RENAMES = [
  { code: 'ING-0164', to: 'Cashew praline' },
  { code: 'ING-0165', to: 'Hafermilch' },
  { code: 'ING-0166', to: 'Maisstärke' },
]

async function main() {
  const all = await get('ingredients?select=id,ingredient_code,name')
  const byCode = new Map(all.map((g) => [g.ingredient_code, g]))
  const namesLc = new Map(all.map((g) => [g.name.trim().toLowerCase(), g]))

  const ok = [], skip = []
  for (const r of RENAMES) {
    const g = byCode.get(r.code)
    if (!g) { skip.push(`${r.code} not found`); continue }
    const collision = namesLc.get(r.to.toLowerCase())
    if (collision && collision.id !== g.id) {
      skip.push(`${r.code} "${g.name}" → "${r.to}" COLLIDES with ${collision.ingredient_code} (would duplicate by name → consider a MERGE instead)`) ; continue
    }
    ok.push({ ...r, id: g.id, from: g.name })
  }

  console.log('RENAMES to apply:')
  for (const r of ok) console.log(`  ${r.code}  "${r.from}"  →  "${r.to}"`)
  if (skip.length) { console.log('\nSKIPPED:'); for (const s of skip) console.log(`  ${s}`) }

  const esc = (s) => s.replace(/'/g, "''")
  const sql = ['-- V4.2 cosmetic ingredient renames (strip pack-size numbers from name).', '']
  const rb = ['-- Rollback for renames.sql.', '']
  for (const r of ok) {
    sql.push(`update public.ingredients set name = '${esc(r.to)}' where id = '${r.id}';  -- was "${r.from}"`)
    rb.push(`update public.ingredients set name = '${esc(r.from)}' where id = '${r.id}';`)
  }
  sql.push('', "notify pgrst, 'reload schema';")
  rb.push('', "notify pgrst, 'reload schema';")
  writeFileSync(`${ROOT}/audit/renames.sql`, sql.join('\n'))
  writeFileSync(`${ROOT}/audit/renames_rollback.sql`, rb.join('\n'))
  console.log(`\n→ wrote audit/renames.sql (${ok.length}) + audit/renames_rollback.sql`)
}
main().catch((e) => console.log('error:', e.message))
