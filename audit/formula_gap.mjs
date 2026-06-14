// Quantify the Phase-3 formula gap using the spec's own worked example.
// Reference engine (Phase 3):
//   Required   = portionQty × pax
//   Production = Required × (1 + loss%)
//   Purchasing = Production ÷ yield%
// Current V4.1 engine:
//   Scaled     = recipeQty × (pax / base)   [no loss, no yield]
//   Purchasing = Production (identical)

const pax = 100, portionQty = 150 /* g */, loss = 0.10, yield_ = 0.80

const required = portionQty * pax
const production = required * (1 + loss)
const purchasing = production / yield_

console.log('Phase-3 reference (spec worked example):')
console.log(`  required   = ${required} g  (15 kg)`)
console.log(`  production = ${production} g  (16.5 kg)`)
console.log(`  purchasing = ${purchasing} g  (20.625 kg)\n`)

// Current engine, assuming the recipe stored 150 g/portion with base = 1:
const curProduction = portionQty * (pax / 1)
const curPurchasing = curProduction
console.log('Current V4.1 engine (loss=0, yield=100%):')
console.log(`  production = ${curProduction} g`)
console.log(`  purchasing = ${curPurchasing} g\n`)

const pErr = (curProduction - production) / production * 100
const buyErr = (curPurchasing - purchasing) / purchasing * 100
console.log('Error vs Phase-3 reference:')
console.log(`  production: ${pErr.toFixed(1)} %  (under-produces — no waste buffer)`)
console.log(`  purchasing: ${buyErr.toFixed(1)} %  (under-buys — no yield compensation)`)
