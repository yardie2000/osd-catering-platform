# OSD Catering Platform – V5.0 Spec (P3)

**Import-Review · Matching-Center · Lieferanten-/Bestelllogik · Mausclick-Mapping**

Status: Entwurf · Stand 2026-06-14 · Voraussetzung: V4.5-Konsolidierung + P1/P2 abgeschlossen.

---

## 1. Zweck & Abgrenzung

V5.0 schließt die operative Kette **verkaufte Menüs → Produktion → Einkauf** an beiden Enden:

- **Eingang:** verlässliche Datenübernahme aus Excel **und** Mausclick (Verkaufsdaten) mit Review statt Blind-Import.
- **Ausgang:** aus dem Einkaufsbedarf werden echte, lieferantenbezogene **Bestellungen**.

Die Plattform bleibt operative Kalkulations-Engine — **kein** CRM, Angebots-, Event- oder Personalsystem. Mausclick/CrewBrain bleiben führende Fremdsysteme; V5.0 ist Middleware.

**Leitprinzipien**
1. *Review-vor-Commit* statt direktem Schreiben.
2. Bestehende, bereits angelegte Bausteine nutzen (`MATCH_STATUS_*`, `IMPORT_MATCH_CONFIDENCE_*`, `supplier_products`, `purchasing_lists`/`_items`) statt neu erfinden.
3. DB technisch snake_case/englisch, UI deutsch & fachlich.
4. Migrationen additiv & idempotent; Menü (verkaufsnah) und Rezept (produktionsnah) bleiben getrennt.

---

## 2. Ist-Stand (code-belegt)

| Bereich | Heute | Lücke |
|---|---|---|
| Import-Engine | [`ExcelImportEngine.run()`](lib/importers/ExcelImportEngine.ts) parst alle Sheets, importiert in Abhängigkeitsreihenfolge, schreibt **direkt**; `recipe_ingredients`/`menu_items` per Full-Replace | Dry-Run liefert nur Zähler; **kein persistierter Diff/Review**; kein selektives Commit |
| Matching | implizit in [`MenuItemImporter.resolveRecipeId`](lib/importers/MenuItemImporter.ts): `recipe_code` → exakt-eindeutiger Name → `null` | keine Confidence, keine manuelle Bestätigung, **keine persistente Zuordnung** |
| Matching-Konstanten | `MATCH_STATUS_VALUES`, `MATCH_STATUS_LABELS`, `IMPORT_MATCH_CONFIDENCE_MIN/MAX` in [types/index.ts](types/index.ts) | **definiert, aber nirgends genutzt** |
| Job-Protokoll | `import_jobs` + `data_import_log` (Status inkl. `rolled_back`) | `rolled_back` nie real umgesetzt; kein Undo |
| Lieferanten | `supplier_products` (Packung, Preis, MOQ, Lieferzeit); Aggregat wählt günstigsten passenden Artikel ([aggregate.ts](lib/purchasing/aggregate.ts) `resolveSupplier`) | keine MOQ-/Packungs-Rundung, **keine Bestellungen**, keine Gruppierung nach Lieferant |
| Bestell-Persistenz | Tabellen `purchasing_lists` / `purchasing_list_items` existieren | werden **nicht befüllt** (Purchasing-Output ist rein flüchtig berechnet) |
| Verkaufsdaten | manuelle Eingabe via `kitchen_batches` + `kitchen_batch_items` (Menü+Pax) | **kein Mausclick-Import/Mapping** |

---

## 3. Datenmodell-Ergänzungen (additive Migrationen)

> Reihenfolge `2026061x…`, idempotent, `notify pgrst`.

### 3.1 `import_staging_rows` (Teilprojekt A)
```
id uuid pk
import_job_id uuid → import_jobs(id) on delete cascade
entity_type text                  -- 'unit'|'ingredient'|'supplier'|'recipe'|'recipe_ingredient'|'menu'|'menu_item'
source_sheet text null
row_number int null
raw jsonb not null                -- Originalzeile
parsed jsonb not null             -- normalisiert/validiert
action text not null              -- 'insert'|'update'|'skip'
target_id uuid null               -- bei update: getroffene Zielentität
match_status text not null default 'unmatched'   -- MATCH_STATUS_VALUES
match_confidence numeric(5,2) null               -- 0..100
validation jsonb not null default '[]'           -- Fehler/Warnungen je Feld
decided_by text null, decided_at timestamptz null
created_at timestamptz default now()
```

### 3.2 `entity_aliases` (Teilprojekt B – Fundament)
```
id uuid pk
entity_type text not null         -- 'unit'|'ingredient'|'recipe'|'menu'
external_key text not null        -- normalisierter Fremdschlüssel/Code/Name
internal_id uuid not null
source text not null              -- 'excel'|'mausclick'|'manual'
confidence numeric(5,2) null
confirmed boolean not null default false
created_at timestamptz default now()
unique (entity_type, external_key, source)
```
Einmal bestätigte Zuordnungen wirken künftig automatisch (für Excel **und** Mausclick).

### 3.3 `purchase_orders` / `purchase_order_items` (Teilprojekt C)
```
purchase_orders(
  id uuid pk, batch_id uuid null → kitchen_batches(id),
  supplier_name text not null, status text default 'draft',
  ordered_at timestamptz null, notes text null, created_at timestamptz default now())
purchase_order_items(
  id uuid pk, purchase_order_id uuid → purchase_orders(id) on delete cascade,
  ingredient_id uuid → ingredients(id), unit_id uuid → units(id),
  required_quantity numeric, order_quantity numeric,   -- nach MOQ/Pack-Rundung
  pack_size numeric null, pack_count numeric null,
  unit_price numeric null, est_cost numeric null)
```

### 3.4 `sales_imports` (Teilprojekt D, optional persistent)
Roh-Verkaufszeilen aus Mausclick (external_event_key, external_menu_key, pax, event_date) für Idempotenz/Audit.

---

## 4. Teilprojekte

### A. Import-Review / Staging
**Ziel:** Kein Blind-Import. Engine bekommt einen `analyze`-Modus (neben `dryRun`/`commit`):
1. **Analyze:** parst, validiert, matched (Teilprojekt B), schreibt **nur** `import_staging_rows` — Zielentitäten unverändert.
2. **Review-UI** `/operations/imports/[id]/review`: Diff je Entitätstyp, Filter nach `action`/`match_status`/Validierung, Zeilen **bestätigen / ignorieren / Ziel korrigieren**.
3. **Commit:** wendet nur bestätigte Staging-Zeilen an — über die bestehenden Importer, aber gesteuert durch Staging-Entscheidungen statt erneutem Raten.
4. **Rollback:** `import_jobs.status='rolled_back'` real: pro Job erzeugte Datensätze markieren (z. B. `created_by_job uuid` auf Zielzeilen) → gezielt löschbar.

*Refactor:* Importer von „parse+write" auf „parse+stage" / „apply-staged" trennen; Full-Replace bleibt, wird aber erst im Commit ausgelöst.

### B. Matching-Center (empfohlener Startpunkt)
**Ziel:** Die ungenutzten `MATCH_STATUS_*`/Confidence-Konstanten zu einer echten Funktion machen.
- **Generischer Matcher** (`lib/matching/`): exakter Code → 100; exakt-eindeutiger Name → 90; normalisiert (lower, ü→ue, Whitespace/Satzzeichen) → 80; Token-/Levenshtein-Ähnlichkeit → <80 als **Vorschlag**; sonst `unmatched`.
- **`entity_aliases`** zuerst konsultiert → bestätigte Mappings = sofort `matched` (100).
- **Matching-Queue-UI** je Entitätstyp: Fremdwert + Vorschlag + Confidence-Badge, Aktionen „bestätigen / anderes Ziel wählen / ignorieren"; Bestätigung schreibt `entity_aliases`.
- **Menü-zu-Rezept-Härtung:** `resolveRecipeId` nutzt Aliases + Confidence; mehrdeutige Namen → `unmatched` (statt evtl. falschem Link), landen in der Queue statt nur im Log.

### C. Lieferanten-/Bestelllogik
**Ziel:** Aus Einkaufsbedarf echte Bestellungen.
- **Mengenrundung:** Einkaufsmenge → Packungseinheiten (`package_quantity`), `minimum_order_quantity` respektieren; `order_quantity`/`pack_count` ableiten.
- **Gruppierung nach Lieferant → `purchase_orders`** je Lieferant; Items mit Kosten/Alternativen.
- **Persistenz:** aus einem `kitchen_batch` Bestellungen generieren (nutzt bestehendes Aggregat); `purchasing_lists`/`_items` ebenfalls real befüllen.
- **Lieferantenwahl:** günstigster passender `supplier_product` unter Beachtung MOQ/Lieferzeit; Alternativen sichtbar.
- **Export** je Bestellung (CSV/Excel; PDF optional).

### D. Mausclick-Mapping
**Ziel:** Verkaufte Menüs automatisch in die Pipeline.
- **Adapter** (Datei/CSV/Sheet zuerst; API später) → Verkaufszeilen (`external_event_key`, `external_menu_key`, `pax`, `event_date`).
- **Mapping** externer Menü-Keys → `menu_id` via `entity_aliases` (Teilprojekt B); unklare Keys → Matching-Queue.
- **Ergebnis:** erzeugt/aktualisiert `kitchen_batch` + `kitchen_batch_items` (Menü+Pax) → speist die bestehende Production/Purchasing-Logik.
- **Idempotenz** über `external_event_key`/Line-Keys (`sales_imports`).

---

## 5. Empfohlene Reihenfolge

1. **B – Matching-Center + `entity_aliases`** — Fundament; härtet sofort die Menü-zu-Rezept-Zuordnung; nutzt vorhandene Konstanten.
2. **A – Import-Review/Staging** — baut auf dem Matcher auf.
3. **D – Mausclick-Mapping** — nutzt Aliases + (optional) Staging.
4. **C – Bestelllogik** — eigenständig, kann parallel zu A/D laufen.

---

## 6. Offene Entscheidungen (vor Implementierung zu klären)

- **Mausclick-Schnittstelle:** Datei-Export (welches Format/Beispiel?) oder API? Bestimmt Teilprojekt D.
- **Rollback-Tiefe:** echtes Löschen per `created_by_job` vs. Soft-Delete.
- **Fuzzy-Matching:** eigene Normalisierung+Levenshtein vs. Bibliothek (Bundle/Abhängigkeit).
- **Bestellformat:** Pflichtfelder/Export-Layout mit echtem Lieferanten abstimmen.
- **Berechtigungen:** „bestätigen/committen" ist eine kritische Aktion → spätestens hier RLS-/Rollenkonzept härten.

---

## 7. Akzeptanzkriterien (Auszug)

- **A:** Ein Import schreibt im Analyze-Modus 0 Zielzeilen, aber N Staging-Zeilen; Commit schreibt exakt die bestätigten; Rollback entfernt genau die Job-Datensätze. `tsc`/Tests/Build grün.
- **B:** `entity_aliases`-Treffer ergeben `matched`/Confidence 100; mehrdeutige Namen werden `unmatched` (nie falsch verlinkt); bestätigte Zuordnung wirkt beim nächsten Import automatisch.
- **C:** Bestellmenge ≥ MOQ und Vielfaches der Packung; Summe der Positionskosten = Bestellsumme; Export reproduzierbar.
- **D:** Wiederholter Mausclick-Import desselben Events erzeugt keine Duplikate (Idempotenz); unmapped Menüs erscheinen in der Queue, nicht als stiller Fehler.
