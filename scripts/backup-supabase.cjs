#!/usr/bin/env node
/*
 * OSD Catering — Supabase-Backup
 * ------------------------------------------------------------------
 * Sichert ALLE Tabellen der Supabase-Datenbank als JSON-Dateien.
 * Abhängigkeitsfrei: nutzt nur Node (>=18, globales fetch) — KEIN
 * `node_modules` nötig. Läuft am lokalen PC und direkt auf der NAS.
 *
 * Liest Zugangsdaten aus `.env.local` ODER `.env` im Projekt-Hauptordner
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Ausführen:   node scripts/backup-supabase.cjs
 *              (oder:  npm run backup)
 *
 * Ergebnis:    backups/<JJJJ-MM-TT_HHMMSS>/<tabelle>.json  + _manifest.json
 *              (Ordner `backups/` ist gitignored — enthält echte Daten.)
 *
 * Aufräumen:   Backups älter als RETENTION_DAYS (Standard 60) werden gelöscht.
 *
 * Planen:
 *   - Windows (lokaler PC): Aufgabenplanung → wöchentlich →
 *       Programm: node   Argument: scripts\backup-supabase.cjs
 *       Starten in: <Projektordner>
 *   - Synology NAS: DSM → Systemsteuerung → Aufgabenplaner →
 *       Geplante Aufgabe → benutzerdef. Skript →  node /pfad/scripts/backup-supabase.cjs
 *       (Node-Paket im Paket-Zentrum installieren, falls nicht vorhanden.)
 * ------------------------------------------------------------------
 */
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 60)

// Alle bekannten Tabellen. Nicht vorhandene (z. B. nach Cutover) werden übersprungen.
const TABLES = [
  'units', 'ingredients', 'recipes', 'recipe_ingredients', 'supplier_products',
  'menus', 'positions', 'menu_positions', 'position_components',
  'menu_items', 'menu_item_components',
  'import_jobs', 'data_import_log',
  'purchasing_lists', 'purchasing_list_items',
  'production_batches', 'kitchen_batches', 'kitchen_batch_items',
]

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f)
    if (!fs.existsSync(p)) continue
    const env = {}
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    return env
  }
  return process.env
}

function stamp(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

async function dumpTable(url, key, name) {
  const pageSize = 1000
  let offset = 0
  const all = []
  for (;;) {
    const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=${pageSize}&offset=${offset}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!res.ok) {
      const txt = await res.text()
      if (res.status === 404 || /does not exist|Could not find|relation/i.test(txt)) {
        return { skipped: true, reason: txt.slice(0, 120) }
      }
      throw new Error(`${name}: HTTP ${res.status} — ${txt.slice(0, 200)}`)
    }
    const data = await res.json()
    all.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  return { rows: all }
}

function prune(backupsDir, now) {
  if (!fs.existsSync(backupsDir)) return 0
  let removed = 0
  for (const entry of fs.readdirSync(backupsDir)) {
    const dir = path.join(backupsDir, entry)
    try {
      const st = fs.statSync(dir)
      if (st.isDirectory() && (now - st.mtimeMs) > RETENTION_DAYS * 86400_000) {
        fs.rmSync(dir, { recursive: true, force: true })
        removed++
      }
    } catch { /* ignore */ }
  }
  return removed
}

;(async () => {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('FEHLER: NEXT_PUBLIC_SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY fehlen (.env.local / .env).')
    process.exit(1)
  }

  const now = Date.now()
  const dir = path.join(ROOT, 'backups', stamp(new Date(now)))
  fs.mkdirSync(dir, { recursive: true })
  console.log('OSD Catering — Supabase-Backup')
  console.log('Projekt:', url.replace(/^https?:\/\//, '').split('.')[0])
  console.log('Ziel:   ', dir, '\n')

  const manifest = { created_at: new Date(now).toISOString(), tables: {}, total_rows: 0, errors: 0 }
  for (const t of TABLES) {
    try {
      const r = await dumpTable(url, key, t)
      if (r.skipped) { console.log(`  –  ${t.padEnd(22)} übersprungen (nicht vorhanden)`); continue }
      fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(r.rows, null, 0))
      manifest.tables[t] = r.rows.length
      manifest.total_rows += r.rows.length
      console.log(`  ✓  ${t.padEnd(22)} ${r.rows.length} Zeilen`)
    } catch (e) {
      manifest.errors++
      console.error(`  ✗  ${t.padEnd(22)} ${e.message}`)
    }
  }

  fs.writeFileSync(path.join(dir, '_manifest.json'), JSON.stringify(manifest, null, 2))
  const pruned = prune(path.join(ROOT, 'backups'), now)
  console.log(`\nFertig: ${manifest.total_rows} Zeilen, ${manifest.errors} Fehler.` +
    (pruned ? ` ${pruned} alte Backup(s) gelöscht (> ${RETENTION_DAYS} Tage).` : ''))
  process.exit(manifest.errors > 0 ? 1 : 0)
})().catch((e) => { console.error('Abbruch:', e.message); process.exit(1) })
