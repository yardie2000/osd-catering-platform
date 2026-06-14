// Demonstrate the V4.2 engine on the REAL juni batch.
// The old production export = REQUIRED quantities (old engine: loss 0 / yield 100).
// Apply the corrected formula with global defaults (10% loss, 80% yield):
//   physical (mass/volume): production = req×1.10 ; purchasing = production÷0.80
//   count/qualitative:      unchanged (qualitative shown as "n. Bedarf")
// Then re-aggregate purchasing by (ingredient, canonical unit). Mirrors
// lib/purchasing/aggregate.ts exactly (same constants & rules).
const { readFileSync } = require('node:fs')
const OUT = 'D:/Downloads/files/output'
const LOSS = 10, YIELD = 80

const num = (s) => { const t = String(s).trim(); return t === '' ? null : parseFloat(t.replace(/\./g, '').replace(',', '.')) }
function parseCsv(t){const R=[];for(const ln of t.replace(/^﻿/,'').split(/\r?\n/)){if(!ln.trim())continue;const c=[];let cur='',q=false;for(let i=0;i<ln.length;i++){const ch=ln[i];if(q){if(ch==='"'){if(ln[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}else{if(ch==='"')q=true;else if(ch===';'){c.push(cur);cur=''}else cur+=ch}}c.push(cur);R.push(c)}return R}
const MASS = new Set(['g','kg','mg']), VOL = new Set(['ml','l','cl','dl'])
const COUNT = new Set(['stück','stk','st','portion','portionen','dose','dosen'])
function classify(u){const c=(u||'').trim().toLowerCase();if(MASS.has(c))return'mass';if(VOL.has(c))return'volume';if(COUNT.has(c))return'count';return'qualitative'}
function canon(u){const c=(u||'').trim().toLowerCase();if(c==='g'||c==='kg')return{key:'b:g',label:'g',f:c==='kg'?1000:1};if(c==='l'||c==='ml')return{key:'b:ml',label:'ml',f:c==='l'?1000:1};return{key:`u:${c}`,label:u,f:1}}
const fmt = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)

// required, per (ingredient name, canonical unit), from the production export
const prod = parseCsv(readFileSync(`${OUT}/produktion_juni.csv`, 'utf8')).slice(1)
const agg = new Map()
for (const r of prod) {
  const [, , , , zutat, menge, einheit] = r
  if (!zutat || zutat.startsWith('(keine')) continue
  const q = num(menge); if (q == null) continue
  const c = canon(einheit), cls = classify(c.label)
  const required = q * c.f
  const physical = cls === 'mass' || cls === 'volume'
  const production = physical ? required * (1 + LOSS / 100) : required
  const purchasing = physical ? production / (YIELD / 100) : production
  const key = `${zutat.trim()}::${c.key}`
  const e = agg.get(key) || { name: zutat.trim(), label: c.label, cls, required: 0, production: 0, purchasing: 0 }
  e.required += required; e.production += production; e.purchasing += purchasing
  agg.set(key, e)
}

const lines = [...agg.values()]
const physical = lines.filter((l) => l.cls === 'mass' || l.cls === 'volume')
const qualitative = lines.filter((l) => l.cls === 'qualitative')

console.log('═══ V4.2 corrected juni purchasing (10% loss, 80% yield) ═══\n')
console.log('Representative physical ingredients — OLD (=required) → NEW purchasing:')
const show = ['Auberginen','Cashew praline 500','Flour 405','Grüne Linsen, gekocht','Raps Oil','Hafer milch 700','Pflanzenöl','Salt']
for (const name of show) {
  const l = physical.find((x) => x.name === name); if (!l) continue
  console.log(`  ${name.padEnd(26)} ${fmt(l.required).padStart(11)} → ${fmt(l.purchasing).padStart(11)} ${l.label}  (×1.375)`)
}
const sumOld = physical.reduce((s, l) => s + l.required, 0)
const sumNew = physical.reduce((s, l) => s + l.purchasing, 0)
console.log(`\n  physical lines: ${physical.length}`)
console.log(`  Σ required (old)    : ${fmt(sumOld)} (g+ml combined)`)
console.log(`  Σ purchasing (new)  : ${fmt(sumNew)}  (+${fmt(sumNew - sumOld)}, ×${(sumNew/sumOld).toFixed(3)})`)
console.log(`\n  qualitative lines now flagged "n. Bedarf" (not summed as quantities): ${qualitative.length}`)
console.log('   ' + qualitative.map((l) => l.name).join(', '))
