// Inspect the corrected recipe database for yield-related fields.
const XLSX = require('xlsx')

const FILE = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const wb = XLSX.readFile(FILE)

console.log('SHEETS:', wb.SheetNames, '\n')

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  console.log('═'.repeat(70))
  console.log(`SHEET: ${name}   (${rows.length} rows)`)
  let hdrIdx = rows.findIndex((r) => r.filter((c) => String(c).trim() !== '').length > 1)
  if (hdrIdx < 0) hdrIdx = 0
  const header = rows[hdrIdx].map((c) => String(c).trim())
  console.log(`header row #${hdrIdx + 1}:`)
  header.forEach((h, i) => { if (h) console.log(`   [${i}] ${h}`) })
  const hit = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /yield|ausbeute|ertrag|portion|menge|gramm|gewicht|loss|verlust|schwund|abschnitt|garverlust|base|basis/i.test(h))
  if (hit.length) {
    console.log('   ★ yield/loss/portion candidates:', hit.map((x) => `[${x.i}]${x.h}`).join('  '))
  }
  console.log('sample rows:')
  for (const r of rows.slice(hdrIdx + 1, hdrIdx + 4)) {
    const obj = {}
    header.forEach((h, i) => { if (h && String(r[i]).trim() !== '') obj[h] = r[i] })
    console.log('   ', JSON.stringify(obj))
  }
}
