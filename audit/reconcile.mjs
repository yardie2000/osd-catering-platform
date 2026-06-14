// ─────────────────────────────────────────────────────────────────────────
// V4.1 audit — deterministic reconciliation of the "juni" batch outputs.
//
// Re-aggregates the EXPORTED production CSV (produktion_juni.csv) by
// (ingredient name, canonical unit) — applying the same metric merges the app
// claims to do (kg→g ×1000, l/L→ml ×1000) — and diffs the result against the
// EXPORTED purchasing CSV (einkauf_juni.csv).
//
// Goal: prove whether "purchasing totals == production totals" (Phase 6) and
// whether unit normalisation (kg/g, l/ml) is correct, using only the real
// output files as the source of truth (no DB access, no assumptions).
//
//   node audit/reconcile.mjs
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'

const OUT = 'D:/Downloads/files/output'

// German decimal: "9.818,18" → 9818.18 , "3.500" → 3500 , "2,8" → 2.8
function num(s) {
  if (s == null) return null
  const t = String(s).trim()
  if (t === '') return null
  return parseFloat(t.replace(/\./g, '').replace(',', '.'))
}

// Parse a ;-delimited, "-quoted CSV into rows of string arrays.
function parseCsv(text) {
  const rows = []
  for (const lineRaw of text.split(/\r?\n/)) {
    if (lineRaw.trim() === '') continue
    const cells = []
    let cur = '', inQ = false
    for (let i = 0; i < lineRaw.length; i++) {
      const ch = lineRaw[i]
      if (inQ) {
        if (ch === '"') { if (lineRaw[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
        else cur += ch
      } else {
        if (ch === '"') inQ = true
        else if (ch === ';') { cells.push(cur); cur = '' }
        else cur += ch
      }
    }
    cells.push(cur)
    rows.push(cells)
  }
  return rows
}

// Canonical unit key + factor, mirroring lib/purchasing/aggregate.ts#canonicalize.
function canon(unit) {
  const u = (unit || '').trim().toLowerCase()
  if (u === 'g' || u === 'kg') return { key: 'b:g', label: 'g', factor: u === 'kg' ? 1000 : 1 }
  if (u === 'l' || u === 'ml') return { key: 'b:ml', label: 'ml', factor: u === 'l' ? 1000 : 1 }
  return { key: `u:${u}`, label: unit, factor: 1 }
}

const stripBom = (s) => s.replace(/^﻿/, '')

// ── 1. re-aggregate production ───────────────────────────────────────────
const prod = parseCsv(stripBom(readFileSync(`${OUT}/produktion_juni.csv`, 'utf8'))).slice(1)
const reagg = new Map() // `${name}::${canonKey}` → { name, label, qty }
let prodLineCount = 0
for (const r of prod) {
  const [, , , , zutat, menge, einheit] = r
  if (!zutat || zutat.startsWith('(keine')) continue
  const q = num(menge)
  if (q == null) continue
  prodLineCount++
  const c = canon(einheit)
  const key = `${zutat.trim()}::${c.key}`
  const add = q * c.factor
  const e = reagg.get(key)
  if (e) e.qty += add
  else reagg.set(key, { name: zutat.trim(), label: c.label, qty: add })
}

// ── 2. read purchasing ───────────────────────────────────────────────────
const buy = parseCsv(stripBom(readFileSync(`${OUT}/einkauf_juni.csv`, 'utf8'))).slice(1)
const buyMap = new Map()
for (const r of buy) {
  const [, zutat, code, menge, einheit] = r
  if (!zutat) continue
  const q = num(menge)
  const c = canon(einheit)
  const key = `${zutat.trim()}::${c.key}`
  buyMap.set(key, { name: zutat.trim(), code, label: einheit, qty: q })
}

// ── 3. diff ──────────────────────────────────────────────────────────────
const EPS = 0.05
const mismatches = []
const okRows = []
const onlyInProd = []
for (const [key, p] of reagg) {
  const b = buyMap.get(key)
  if (!b) { onlyInProd.push(p); continue }
  const diff = Math.abs(p.qty - b.qty)
  if (diff > EPS) mismatches.push({ name: p.name, unit: p.label, prod: p.qty, buy: b.qty, diff })
  else okRows.push({ name: p.name, unit: p.label, qty: p.qty })
}
const onlyInBuy = []
for (const [key, b] of buyMap) if (!reagg.has(key)) onlyInBuy.push(b)

// ── 4. report ────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n)
console.log('═══ RECONCILIATION: re-aggregated production  vs  exported purchasing ═══\n')
console.log(`production ingredient lines parsed : ${prodLineCount}`)
console.log(`re-aggregated (ingredient,unit) keys: ${reagg.size}`)
console.log(`purchasing rows                     : ${buyMap.size}`)
console.log(`matches within ±${EPS}                  : ${okRows.length}`)
console.log(`MISMATCHES                          : ${mismatches.length}`)
console.log(`only in production (missing in buy) : ${onlyInProd.length}`)
console.log(`only in purchasing (extra in buy)   : ${onlyInBuy.length}\n`)

if (mismatches.length) {
  console.log('── quantity mismatches ─────────────────────────────')
  for (const m of mismatches)
    console.log(`  ${m.name} [${m.unit}ptr]  prod=${fmt(m.prod)}  buy=${fmt(m.buy)}  Δ=${fmt(m.diff)}`)
  console.log('')
}
if (onlyInProd.length) {
  console.log('── present in production, ABSENT from purchasing ───')
  for (const p of onlyInProd) console.log(`  ${p.name} [${p.label}] = ${fmt(p.qty)}`)
  console.log('')
}
if (onlyInBuy.length) {
  console.log('── present in purchasing, ABSENT from production ───')
  for (const b of onlyInBuy) console.log(`  ${b.name} [${b.label}] = ${fmt(b.qty)}`)
  console.log('')
}

// ── 5. fragmentation check: ingredient names that appear under >1 unit ────
const byName = new Map()
for (const { name, label } of [...reagg.values()]) {
  const s = byName.get(name) ?? new Set()
  s.add(label)
  byName.set(name, s)
}
const fragmented = [...byName.entries()].filter(([, s]) => s.size > 1)
console.log(`── ingredients SPLIT across multiple units (aggregation fragmentation): ${fragmented.length} ──`)
for (const [name, s] of fragmented) console.log(`  ${name}: ${[...s].join(' | ')}`)
