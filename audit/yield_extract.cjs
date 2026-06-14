// Extract the true portion base from recipes.yield (and critical_note fallback),
// report coverage, and show how wrong the base-50 guess was for the juni batch.
const XLSX = require('xlsx')
const { readFileSync } = require('node:fs')

const FILE = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const OUT = 'D:/Downloads/files/output'
const wb = XLSX.readFile(FILE)

// recipes sheet: header on row 3 (index 2)
const rec = XLSX.utils.sheet_to_json(wb.Sheets['recipes'], { header: 1, defval: '' }).slice(3)

// Parse "<n> [–<m>] Portionen" / "Portionsbasis: <n> Portionen" → number (range midpoint)
function parsePortions(text) {
  if (!text) return null
  const s = String(text)
  // prefer explicit "Portionsbasis: N"
  const pb = s.match(/Portionsbasis[:\s]*([\d]+)\s*(?:[–-]\s*(\d+))?/i)
  const m = pb || s.match(/(\d+)\s*(?:[–-]\s*(\d+))?\s*Portionen/i)
  if (!m) return null
  const a = parseInt(m[1], 10); if (!a) return null
  const b = m[2] ? parseInt(m[2], 10) : null
  return b ? Math.round((a + b) / 2) : a
}

const byCode = new Map()
const bases = []
let fromYield = 0, fromNote = 0, none = 0
for (const r of rec) {
  const code = String(r[1]).trim()          // component_id e.g. SAU-001
  const name = String(r[2]).trim()
  const yieldRaw = String(r[4]).trim()       // yield col e.g. "50 Portionen"
  const note = String(r[5]).trim()           // critical_note
  if (!code) continue
  let base = parsePortions(yieldRaw), src = 'yield'
  if (base == null) { base = parsePortions(note); src = 'note' }
  if (base == null) { src = 'none'; none++ }
  else if (src === 'yield') fromYield++; else fromNote++
  byCode.set(code, { code, name, yieldRaw, base, src })
  if (base != null) bases.push(base)
}

console.log(`recipes parsed: ${byCode.size}`)
console.log(`  base from yield column : ${fromYield}`)
console.log(`  base from critical_note: ${fromNote}`)
console.log(`  NO parseable base      : ${none}`)
const distinct = [...new Set(bases)].sort((a, b) => a - b)
console.log(`  distinct base values   : ${distinct.join(', ')}\n`)
if (none > 0) {
  console.log('recipes with no parseable yield:')
  for (const v of byCode.values()) if (v.src === 'none') console.log(`   ${v.code}  ${v.name}  yield="${v.yieldRaw}"`)
  console.log('')
}

// ── How wrong was base-50 for the juni batch? ───────────────────────────
// Pull distinct (code, portions) from the exported production CSV.
function num(s){ const t=String(s).trim(); return t===''?null:parseFloat(t.replace(/\./g,'').replace(',','.')) }
function parseCsv(txt){const rows=[];for(const ln of txt.replace(/^﻿/,'').split(/\r?\n/)){if(!ln.trim())continue;const c=[];let cur='',q=false;for(let i=0;i<ln.length;i++){const ch=ln[i];if(q){if(ch==='"'){if(ln[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}else{if(ch==='"')q=true;else if(ch===';'){c.push(cur);cur=''}else cur+=ch}}c.push(cur);rows.push(c)}return rows}
const prod = parseCsv(readFileSync(`${OUT}/produktion_juni.csv`,'utf8')).slice(1)
const seen = new Map() // code → {name, portions, appFactor}
for (const r of prod) {
  const [name, code, portions, faktor] = r
  if (!code || seen.has(code)) continue
  seen.set(code, { name, portions: num(portions), appFactor: num(faktor) })
}

console.log('── juni batch: app base-50 factor  vs  TRUE-yield factor ──')
console.log('code      recipe                         portions  appBase  appFactor  trueBase  trueFactor  qtyError%')
for (const [code, p] of seen) {
  const t = byCode.get(code)
  const trueBase = t?.base ?? null
  const appBase = p.portions / p.appFactor            // reverse out what base the app used
  const trueFactor = trueBase ? p.portions / trueBase : null
  const err = trueFactor ? ((p.appFactor - trueFactor) / trueFactor * 100) : null
  console.log(
    `${code.padEnd(9)} ${(t?.name||p.name).slice(0,30).padEnd(30)} ${String(p.portions).padStart(8)} ` +
    `${String(Math.round(appBase)).padStart(7)} ${String(p.appFactor).padStart(9)} ` +
    `${String(trueBase??'—').padStart(8)} ${String(trueFactor?trueFactor.toFixed(2):'—').padStart(10)} ` +
    `${err==null?'   n/a':(err>0?'+':'')+err.toFixed(0)+'%'}`
  )
}
