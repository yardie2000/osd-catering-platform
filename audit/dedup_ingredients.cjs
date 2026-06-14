// Analyse ingredient duplicates (E5) and generate REVERSIBLE merge/rename SQL.
// Conservative: auto-merge only (a) exact normalised-name duplicates and (b) a
// curated EN↔DE / artifact synonym list, and ONLY when BOTH names exist live.
// Everything else is listed as REVIEW. Re-points recipe_ingredients (+ supplier_
// products) to the canonical id, then deletes the duplicate. Writes
// audit/dedup_merge.sql + audit/dedup_rollback.sql.
//   node audit/dedup_ingredients.cjs
const { readFileSync, writeFileSync } = require('node:fs')
const ROOT = 'D:/Downloads/files/catering-platform-v4_1'
const env = readFileSync(`${ROOT}/.env.local`, 'utf8')
const URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const ANON = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const H = { apikey: ANON, Authorization: `Bearer ${ANON}` }
const get = async (p) => { const r = await fetch(`${URL}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }

// canonical German name → list of duplicate spellings to fold in (lower-case match)
const SYNONYMS = {
  'Salz':          ['salt', 'salt 2 g cashew praline'],
  'Olivenöl':      ['olive oil'],
  'Zitronensaft':  ['lemon juice'],
  'Senf':          ['mustard'],
  'Wasser':        ['h2o', 'water (on500 gr cashew)'],
  'Zucker':        ['sugar'],
  'Knoblauch':     ['garlic'],
  'Eigelb':        ['egg yolk'],
  'Mehl':          ['flour'],     // only folds a bare "flour"; "Flour 405" (a flour TYPE) is left alone
}

async function main() {
  const ings = await get('ingredients?select=id,ingredient_code,name&order=name')
  const ri = await get('recipe_ingredients?select=ingredient_id')
  const sp = await get('supplier_products?select=ingredient_id')
  const useCount = new Map()
  for (const r of ri) useCount.set(r.ingredient_id, (useCount.get(r.ingredient_id) || 0) + 1)
  const spCount = new Map()
  for (const r of sp) spCount.set(r.ingredient_id, (spCount.get(r.ingredient_id) || 0) + 1)

  const byNameLc = new Map()  // lower name → ingredient[]
  for (const g of ings) {
    const k = g.name.trim().toLowerCase()
    byNameLc.set(k, [...(byNameLc.get(k) || []), g])
  }
  const find = (nameLc) => (byNameLc.get(nameLc) || [])[0]

  const merges = []   // { keep, drop, reason }
  const used = new Set()

  // (a) exact normalised-name duplicates → keep lowest code, fold the rest
  for (const [k, list] of byNameLc) {
    if (list.length < 2) continue
    const sorted = list.slice().sort((a, b) => a.ingredient_code.localeCompare(b.ingredient_code))
    const keep = sorted[0]
    for (const drop of sorted.slice(1)) { merges.push({ keep, drop, reason: 'exact name' }); used.add(drop.id); used.add(keep.id) }
  }

  // (b) curated synonyms → fold into the German canonical (only if canonical exists)
  for (const [canon, alts] of Object.entries(SYNONYMS)) {
    const keep = find(canon.toLowerCase())
    if (!keep) continue
    for (const alt of alts) {
      const drop = find(alt)
      if (drop && drop.id !== keep.id && !used.has(drop.id)) {
        merges.push({ keep, drop, reason: `synonym → ${canon}` }); used.add(drop.id); used.add(keep.id)
      }
    }
  }

  const C = (g) => `${g.ingredient_code} ${g.name} (use ${useCount.get(g.id) || 0})`
  console.log(`ingredients total: ${ings.length}\n`)
  console.log(`PROPOSED MERGES (${merges.length}):`)
  for (const m of merges) console.log(`  KEEP ${C(m.keep).padEnd(40)} ⟵ DROP ${C(m.drop)}   [${m.reason}]`)

  // names containing digits → REVIEW for renaming (not auto-changed; "Flour 405" etc. may be legit)
  const digitNames = ings.filter((g) => /\d/.test(g.name) && !used.has(g.id))
  console.log(`\nREVIEW — names with embedded numbers (manual rename, not auto-touched): ${digitNames.length}`)
  for (const g of digitNames) console.log(`  ${g.ingredient_code} "${g.name}" (use ${useCount.get(g.id) || 0})`)

  // Capture the EXACT recipe_ingredient rows that will be re-pointed, so the
  // rollback can restore them precisely (fully reversible).
  const dropIds = merges.map((m) => m.drop.id)
  const affected = dropIds.length
    ? await get(`recipe_ingredients?select=id,ingredient_id&ingredient_id=in.(${dropIds.join(',')})`)
    : []
  const riByDrop = new Map()
  for (const row of affected) riByDrop.set(row.ingredient_id, [...(riByDrop.get(row.ingredient_id) || []), row.id])

  // SQL — re-point then delete (FK is ON DELETE RESTRICT). supplier_products too.
  const sql = ['-- V4.2 ingredient de-dup (E5) — re-point references to the canonical id, then drop the duplicate.', '-- Fully reversible via audit/dedup_rollback.sql. REVIEW before running.', '']
  const rb = ['-- Rollback for dedup_merge.sql — re-creates the dropped ingredients and re-points the', '-- exact recipe_ingredient rows back to them (captured pre-merge). Run as one transaction.', 'begin;', '']
  const snapshot = []
  for (const m of merges) {
    const riIds = riByDrop.get(m.drop.id) || []
    sql.push(`-- ${m.drop.ingredient_code} "${m.drop.name}" (${riIds.length} recipe links) → ${m.keep.ingredient_code} "${m.keep.name}"`)
    sql.push(`update public.recipe_ingredients set ingredient_id = '${m.keep.id}' where ingredient_id = '${m.drop.id}';`)
    if ((spCount.get(m.drop.id) || 0) > 0) sql.push(`update public.supplier_products set ingredient_id = '${m.keep.id}' where ingredient_id = '${m.drop.id}';`)
    sql.push(`delete from public.ingredients where id = '${m.drop.id}';`, '')
    rb.push(`insert into public.ingredients (id, ingredient_code, name) values ('${m.drop.id}', '${m.drop.ingredient_code.replace(/'/g, "''")}', '${m.drop.name.replace(/'/g, "''")}') on conflict (id) do nothing;`)
    if (riIds.length) rb.push(`update public.recipe_ingredients set ingredient_id = '${m.drop.id}' where id in (${riIds.map((x) => `'${x}'`).join(', ')});`)
    snapshot.push({ keepId: m.keep.id, dropId: m.drop.id, dropCode: m.drop.ingredient_code, dropName: m.drop.name, recipeIngredientIds: riIds })
  }
  sql.push("notify pgrst, 'reload schema';")
  rb.push('', 'commit;', "notify pgrst, 'reload schema';")
  writeFileSync(`${ROOT}/audit/dedup_merge.sql`, sql.join('\n'))
  writeFileSync(`${ROOT}/audit/dedup_rollback.sql`, rb.join('\n'))
  writeFileSync(`${ROOT}/audit/dedup_premerge.json`, JSON.stringify(snapshot, null, 2))
  console.log(`\n→ wrote audit/dedup_merge.sql (${merges.length} merges), dedup_rollback.sql, dedup_premerge.json`)
}
main().catch((e) => console.log('error:', e.message))
