// Full recipe-yield coverage + duplicate detection.
// Writes audit/recipe_yields.csv (code,name,raw_yield,parsed_base,source,n_ingredients,dup_group)
const XLSX = require('xlsx')
const { writeFileSync } = require('node:fs')

const FILE = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const wb = XLSX.readFile(FILE)
const recRows = XLSX.utils.sheet_to_json(wb.Sheets['recipes'], { header: 1, defval: '' }).slice(3)
const riRows  = XLSX.utils.sheet_to_json(wb.Sheets['recipe_ingredients'], { header: 1, defval: '' }).slice(3)

function parsePortions(text) {
  if (!text) return null
  const s = String(text)
  const pb = s.match(/Portionsbasis[:\s]*([\d]+)\s*(?:[–-]\s*(\d+))?/i)
  const m = pb || s.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*Portionen/i)
  if (!m) return null
  const a = parseInt(m[1], 10); if (!a) return null
  const b = m[2] ? parseInt(m[2], 10) : null
  return b ? Math.round((a + b) / 2) : a
}
// classify the raw yield text by what UNIT it expresses
function yieldKind(raw) {
  if (!raw) return 'empty'
  if (/Portion/i.test(raw)) return 'portions'
  if (/\bg\b|gramm|kg/i.test(raw)) return 'grams'
  if (/\bml\b|liter|\bl\b/i.test(raw)) return 'volume'
  return 'other'
}

// ingredient counts per numeric recipe_id
const ingCount = new Map()
for (const r of riRows) {
  const rid = String(r[1]).trim()
  if (!rid) continue
  ingCount.set(rid, (ingCount.get(rid) || 0) + 1)
}

// normalize name for duplicate grouping (strip ▶, accents, case, spaces)
const norm = (n) => String(n).replace(/▶/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]/g, '')

const recipes = []
for (const r of recRows) {
  const rid = String(r[0]).trim()
  const code = String(r[1]).trim()
  const name = String(r[2]).trim()
  const raw  = String(r[4]).trim()
  const note = String(r[5]).trim()
  if (!code) continue
  let base = parsePortions(raw), src = 'yield'
  if (base == null) { base = parsePortions(note); src = 'note' }
  if (base == null) src = 'none'
  recipes.push({ rid, code, name, raw, base, src, kind: yieldKind(raw), n: ingCount.get(rid) || 0, key: norm(name) })
}

// duplicate groups by normalized name
const groups = new Map()
for (const r of recipes) { const a = groups.get(r.key) || []; a.push(r); groups.set(r.key, a) }
let dupGroupId = 0
const dupOf = new Map()
for (const [, arr] of groups) if (arr.length > 1) { dupGroupId++; for (const r of arr) dupOf.set(r.code, dupGroupId) }

// ── summary ──
const withBase = recipes.filter(r => r.base != null)
const kinds = {}
for (const r of recipes) kinds[r.kind] = (kinds[r.kind] || 0) + 1
console.log(`total recipes          : ${recipes.length}`)
console.log(`with parseable base    : ${withBase.length}  (yield col + notes)`)
console.log(`yield text by kind     : ${JSON.stringify(kinds)}`)
console.log(`with ingredients (>0)  : ${recipes.filter(r => r.n > 0).length}`)
console.log(`duplicate-name groups  : ${dupGroupId} (covering ${[...dupOf.keys()].length} recipes)\n`)

console.log('── duplicate-name groups (▶REC-00xx vs canonical code) ──')
for (const [, arr] of groups) if (arr.length > 1) {
  console.log('  ' + arr.map(r => `${r.code}${r.base!=null?`(base ${r.base})`:'(no base)'}/${r.n}ing`).join('   ↔   ') + `   « ${arr[0].name.replace('▶ ','')}`)
}

// ── write CSV artifact ──
const cell = (v) => `"${String(v).replace(/"/g, '""')}"`
const head = ['code','name','raw_yield','parsed_base','source','yield_kind','n_ingredients','dup_group']
const lines = recipes
  .sort((a,b)=>a.code.localeCompare(b.code))
  .map(r => [r.code, r.name, r.raw, r.base ?? '', r.src, r.kind, r.n, dupOf.get(r.code) ?? ''].map(cell).join(';'))
writeFileSync('D:/Downloads/files/catering-platform-v4_1/audit/recipe_yields.csv', '﻿' + [head.map(cell).join(';'), ...lines].join('\r\n'))
console.log('\n→ wrote audit/recipe_yields.csv')
