# OSD Catering — V5 Status & Übergabe (Fortsetzung in neuem Chat)

Stand-Dokument für die **Weiterführung in einem neuen Chat** (Phase 4 ff.).
App-Version **4.5.0** (`package.json`, Sidebar-Footer). Feature-Linie: **geteilter
Positions-Katalog (Stückliste/Komponenten)**. Branch: `claude/magical-hamilton-8042cf`.

Zugehörige Specs: [Komponenten](OSD_CATERING_PLATFORM_KOMPONENTEN_SPEC.md) ·
[Positionen](OSD_CATERING_PLATFORM_POSITIONEN_SPEC.md).

---

## 1. Was fertig ist (live, verifiziert)

**Phase 1 — Schema** ✓ · **Phase 2 — Engine** ✓ · **Phase 3 — UI (Katalog + Menü-Editor)** ✓ ·
**Phase 4 — Dubletten-Merge + Import-Blätter** ✓ (statisch verifiziert: tsc/lint/build/Tests grün;
Live-Smoke offen — siehe §8).

Datenmodell-Hierarchie (aktiv):
```
Menü → menu_positions → positions → position_components → recipe/ingredient → recipe_ingredients → Zutat
```
- **Geteilte Positionen**: eine Position einmal pflegen, in mehreren Menüs nutzen.
- **Komponenten** (Rezept ODER Zutat, Menge/Portion) hängen an der **Position**.
- Engine ist **2-stufig**: Rezept-Komponente → Vorproduktion (Produktionsplan) + deren Roh-Zutaten in den Einkauf; Zutat-Komponente → direkt Einkauf.
- **Legacy-Fallback**: `menu_items` + `menu_item_components` existieren noch; die Engine nutzt sie nur, wenn ein Menü keine `menu_positions` hat.

## 2. DB-Stand (Live-Supabase, alle Migrationen eingespielt)

Tabellen: `units, ingredients, recipes, recipe_ingredients, menus, menu_items` (legacy),
`menu_item_components` (legacy), **`positions`, `menu_positions`, `position_components`** (neu),
`import_jobs, data_import_log`, + Stub-/Batch-Tabellen.

Datenmengen (live): **92 positions** (1:1 aus menu_items migriert, **inкл. Dubletten** wie
„Blechkuchen" 2×), **92 menu_positions**, **83 position_components** (80 Rezept- + 3 Zutat-Komp.);
86 recipes, 171 ingredients, 14 units, 9 menus.

Migrationen (in `supabase/migrations/`, alle in der Live-DB):
- `20260616000000_menu_item_components.sql` (Komponenten an menu_items, Backfill)
- `20260616000001_positions_catalog.sql` (positions/menu_positions/position_components + 1:1-Migration)
- (frühere: `20260604000000_menu_items_standalone_columns.sql` u. a.)

## 3. Code-Landkarte

- **Engine:** `lib/purchasing/aggregate.ts` (`explodeMenuRows`, `aggregatePurchasing`,
  Komponenten-Typen), `lib/production/plan.ts` (`buildProductionPlan` → Vorproduktion),
  `lib/operations/calcMenu.ts` (`buildCalcMenus`: menu_positions→CalcMenu, Legacy-Fallback),
  `lib/operations/computeBatchOutputs.ts`.
- **Daten/Services:** `services/positions.service.ts` (+ `hooks/use-positions.ts`),
  `services/menus.service.ts` (menu_positions-CRUD, + `hooks/use-menus.ts`),
  `services/purchasing.service.ts` (`getMenusForCalc` lädt Positions-Pfad).
- **UI:** `app/(admin)/master-data/positions/page.tsx` (Katalog), 
  `components/master-data/positions/position-components-dialog.tsx` + `position-picker.tsx`,
  `components/master-data/menus/menu-positions-manager.tsx`,
  `app/(admin)/master-data/menus/[id]/page.tsx` (auf Katalog umgebaut),
  `components/layout/sidebar.tsx` (Eintrag „Positionen"). 
  `app/(admin)/operations/production/page.tsx` (Abschnitt „Vorproduktion").
- **Typen:** `types/database.ts` (Position/MenuPosition/PositionComponent + Database-Tables-Einträge).
- **Tests:** `tests/calc.test.ts` (27 Tests: Engine + Komponenten + buildCalcMenus), `tests/produktbedarf.test.ts` (10),
  `tests/positions-import.test.ts` (12: Import-Schemas der 3 neuen Blätter). `npm test` läuft jetzt alle drei.
- **Phase-4-Code (neu):** `lib/importers/PositionImporter.ts` (importPositions/importMenuPositions/importPositionComponents),
  Schemas in `lib/importers/ValidationEngine.ts` (positionRowSchema/menuPositionRowSchema/positionComponentRowSchema),
  Verdrahtung + SHEET_MAP + Summary in `lib/importers/ExcelImportEngine.ts`,
  `positionsService.merge()` in `services/positions.service.ts` + `useMergePositions` in `hooks/use-positions.ts`,
  `components/master-data/positions/position-merge-dialog.tsx`, „Zusammenführen"-Button in `app/(admin)/master-data/positions/page.tsx`,
  Hinweistext in `app/(admin)/operations/imports/page.tsx`.
- **Verwaist** (nicht mehr genutzt, kann später weg): `components/master-data/menus/menu-item-components-dialog.tsx`.
- **Wegwerf-Helfer** (NICHT committen, löschen): `zukauf_rezepte.cjs`.

## 4. Phase 4 — fertig (gebaut)

- **4a — Dubletten-Zusammenführen-Werkzeug** ✓: „Zusammenführen"-Button je Positionszeile →
  Dialog wählt Zielposition (Picker). `positionsService.merge(sourceId, targetId)` hängt um:
  `menu_positions` der Quelle als neue Ziel-Zuordnungen anlegen (sort_order/price_override
  übernommen), Konflikte (Ziel im selben Menü schon vorhanden, UNIQUE menu_id+position_id)
  entfallen; `position_components` der Quelle, die das Ziel (nach recipe/ingredient) noch nicht
  hat, ans Ziel anhängen — Rest verwirft der Cascade; dann Quelle löschen. **Client-seitig**
  (kein neues Migration/RPC nötig, nutzt anon/authenticated FOR ALL-Policies). Umhängen per
  delete+insert, weil die Update-Typen `menu_id`/`position_id` bewusst sperren.
- **4b — Import-Blätter** ✓: `positions` (position_code, name, description, dietary, allergens,
  default_price · Upsert per position_code · Schritt 8), `menu_positions` (menu_code, position_code,
  sort_order, price_override · Upsert onConflict menu_id,position_id · Schritt 9), `position_components`
  (position_code, recipe_code|ingredient_code, quantity, unit_code, sort_order · Full-Replace je
  Position · Schritt 10). Matching durchgehend über *_code; Engine importiert nach menu_items.
  Aliase in `SHEET_MAP` (positions/positionen, menu_positions, position_components/positions_komponenten),
  Header in Zeile 0 (range 0 wie menu_items).
  - *Bekannte Grenze:* in einem reinen **Dry-Run** mit brandneuen Zutaten/Einheiten werden diese in
    `position_components` nicht aufgelöst (Komponenten-Importer liest Rezepte/Zutaten/Einheiten frisch
    aus der DB + überlagert nur die Rezept-Code-Map des Laufs). Im echten Lauf sind sie zum Zeitpunkt
    des Komponenten-Imports bereits geschrieben → werden gefunden. Als Warnung protokolliert.

## 5. Phase 5 — Cutover (aufgeschoben, destruktiv)

`menu_items` + `menu_item_components` entfernen, sobald nichts mehr darauf zeigt. **Nur auf
ausdrücklichen Wunsch** — irreversibel; Legacy-Fallback schadet aktuell nicht.

## 6. Betriebs-Fakten / Gotchas (wichtig für den neuen Chat)

- **Worktree:** `D:\Downloads\files\catering-platform-v4_2\.claude\worktrees\magical-hamilton-8042cf`.
  `node_modules` lokal via `npm install --legacy-peer-deps` (React-19-RC-Peer-Konflikt).
- **Dev-Server:** `npm run dev` (Turbopack). Bei „missing required error components, refreshing…"
  → Dev-Server neu starten (Turbopack-Hänger nach vielen Hot-Reloads, kein Code-Fehler).
- **Build:** `next build` braucht Supabase-Env, sonst Prerender-Fehler `supabaseUrl is required`.
  Zum Verifizieren Platzhalter: `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x SUPABASE_SERVICE_ROLE_KEY=x npx next build`.
- **`.env.local`** vorhanden (gitignored), `service_role`-Key korrekt → DB-Schreiben/Lesen geht.
- **Lint:** `npx eslint .` (Flat-Config). **Tests:** `node --import ./tests/register.mjs --test tests/calc.test.ts tests/produktbedarf.test.ts`.
- **DB-Checks ad hoc:** Node-Skript mit `@supabase/supabase-js`, `.env.local` parsen, `NODE_PATH=<repo>/node_modules` (parent-Repo hat node_modules).
- **GitHub:** privates Repo `yardie2000/osd-catering-platform`. **Push muss der User machen** —
  Agent-Push wird von der Datenschutz-Sperre blockiert (Kundendaten in `output/`). `gh` ist NICHT installiert.
- **Sicherheitsschranke:** Batch-DB-Schreibvorgänge mit vom Agent „geratenen" Parametern können
  blockiert werden → dann SQL/Skript vom User ausführen lassen (Muster: Migrationen im SQL-Editor).
- **Kundendaten:** `output/` enthält echte Kundennamen → privat halten, nicht öffentlich pushen.

## 7. Offener Commit-Stand (Phasen 1–4, noch nicht committet)

Geändert: `app/(admin)/master-data/menus/[id]/page.tsx`, `app/(admin)/operations/imports/page.tsx`,
`app/(admin)/operations/production/page.tsx`, `components/layout/sidebar.tsx`, `hooks/use-menus.ts`,
`lib/importers/ExcelImportEngine.ts`, `lib/importers/ValidationEngine.ts`, `lib/production/plan.ts`,
`lib/purchasing/aggregate.ts`, `package.json` (test-Skript), `services/batch.service.ts`,
`services/menus.service.ts`, `services/purchasing.service.ts`, `tests/calc.test.ts`, `types/database.ts`.
Neu: beide Specs + dieses Status-Dokument, `app/(admin)/master-data/positions/`,
`components/master-data/menus/menu-positions-manager.tsx`, `components/master-data/menus/menu-item-components-dialog.tsx`,
`components/master-data/positions/` (inkl. `position-merge-dialog.tsx`), `hooks/use-positions.ts`,
`lib/importers/PositionImporter.ts`, `lib/operations/calcMenu.ts`, `services/positions.service.ts`,
`tests/positions-import.test.ts`, beide neuen Migrationen.
**Empfohlener Commit** (Push durch User): „Add shared positions catalog (schema, engine, UI, merge tool, import sheets) + component model — Phases 1–4". `zukauf_rezepte.cjs` dabei **auslassen**.

> 4a/4b brauchen **keine** neue Migration — beide nutzen die in Phase 1 angelegten Tabellen/Policies.

## 8. Verifikationsstand

**Phasen 1–3:** Typecheck ✓ · Lint ✓ · Build ✓ · Live-Smoke ✓ (Positionen-Katalog, Menü-Editor +
Picker, Komponenten-Dialoge, Bedarfs-Embed).

**Phase 4 (statisch, im Worktree magical-hamilton):** `tsc --noEmit` ✓ · `eslint .` ✓ ·
**49 Tests ✓** (27 calc + 10 produktbedarf + 12 positions-import; node-Test-Runner zählt bei
Mehr-Datei-Läufen die Summe kosmetisch zu niedrig, einzeln je Datei verifiziert, 0 Fehler) ·
`next build` mit Platzhalter-Env ✓ (Route `/master-data/positions` 10.3 kB inkl. Merge-Dialog).

**Phase 4 Live-Smoke offen:** Der Preview-/Dev-Server-Tooling-Pfad hängt am Primär-Worktree
(`elated-carson-…`, V4.3, ohne node_modules) — verifiziert NICHT diese Änderungen. Ein korrekt
verorteter Dev-Server (`magical-hamilton`) spräche mit der **Live-Kunden-Supabase**, und Merge/Import
**schreiben/löschen real**. Daher Live-Smoke dem User überlassen:
- **Merge:** `/master-data/positions` → „Zusammenführen" an einer Dublette → Zielposition wählen →
  bestätigen; danach: Quelle weg, Ziel trägt Menü-Zuordnungen + Komponenten, Kalkulation unverändert.
- **Import:** Test-`.xlsx` mit Blättern `positions`/`menu_positions`/`position_components` zuerst als
  **Testlauf** (dryRun) hochladen, dann echt; Idempotenz durch erneutes Hochladen prüfen.
