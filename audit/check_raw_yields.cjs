// Show the RAW yield text for the recipes the sync would change — to catch
// mis-parses (e.g. grabbing "1" from a scaling table) before writing anything.
const XLSX = require('xlsx')
const FILE = 'D:/Downloads/OSD CATERING/OSD Rezepte alle/OSD_Rezeptdatenbank_normalisiert_2_KORRIGIERT.xlsx'
const CODES = ['SAU-010','SAU-011','SAU-014','SAU-016','DIP-004','DIP-005','PUE-010','PUE-011','GEM-006','GEM-007','GEM-008','GEM-016','PRO-013','FRU-002','FLE-001']
const wb = XLSX.readFile(FILE)
const rec = XLSX.utils.sheet_to_json(wb.Sheets['recipes'], { header: 1, defval: '' }).slice(3)
for (const r of rec) {
  const code = String(r[1]).trim()
  if (!CODES.includes(code)) continue
  console.log(`${code.padEnd(9)} name="${String(r[2]).trim()}"`)
  console.log(`          yield="${String(r[4]).trim()}"`)
  const note = String(r[5]).trim()
  if (note) console.log(`          note="${note.slice(0, 120)}${note.length > 120 ? '…' : ''}"`)
}
