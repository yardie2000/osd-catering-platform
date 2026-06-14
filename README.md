# OSD Catering Platform — V4.3

Eine **operative Catering Calculation & Production Engine** — kein allgemeines Eventmanagement-Tool.
Sie verwaltet Stammdaten (Einheiten, Zutaten, Rezepte, Menüs) und leitet daraus **Produktions- und
Einkaufsmengen** ab: aus den verkauften Menüs + Gästezahlen entstehen automatisch Produktionslisten
und Einkaufslisten.

> **Maßgebliche Referenz:** [`OSD_CATERING_PLATFORM_V4_SPEC.md`](OSD_CATERING_PLATFORM_V4_SPEC.md)
> (Release V4.2). Bei Konflikt zwischen Doku, Repo-Migrationen und Live-DB gilt **die Live-DB**.

---

## Status: V4.3 — auf dem Weg zu V4.5

Aktueller Stand **V4.3** — ein konsistenter, kompilierbarer Zwischenstand der V4.5-Konsolidierung
(`tsc` 0 Fehler · Build grün · Tests grün). **V4.5 ist noch nicht erreicht.**

**In V4.3 abgeschlossen**

- **Rezeptbasis vereinheitlicht:** `base_portions` als kanonisches Feld (App-seitig Pflicht, DB
  vorerst nullable) neben `yield_quantity` / `yield_unit_id` / `yield_pct` / `production_loss_pct`.
  Typen, Service, Hooks, Seiten und Migrationen durchgängig konsolidiert; verwaiste/duplizierte
  Typdateien und kaputte camelCase-Migrationen bereinigt.
- **Rezept-UI entdoppelt:** gemeinsame `RecipeForm` für Neu/Bearbeiten, echte read-only
  Rezept-Detailseite, korrigierte Routenpfade.
- **Rechen-Engine:** `base_portions` ist jetzt die **primäre Portionsbasis** (`resolveBase`), vor
  `yield_quantity` → Notiz → Default.
- **Datenqualität:** Rezeptbasis-Vollständigkeit live sichtbar + nicht-destruktiver Backfill
  („Basisportionen aus Ertrag übernehmen").
- **Deutsche Lokalisierung** der Bereiche Rezepte, Zutaten, Einheiten und Datenqualität.

**V4.5 gilt als erreicht, wenn beide Punkte erfüllt sind**

1. **Das Import-Feature ist fertig** — Import-Review/Staging, Matching-Center (belastbare
   Menü-zu-Rezept-Zuordnung) und Lieferanten-/Bestelllogik. Detailplan:
   [`OSD_CATERING_PLATFORM_V5_SPEC.md`](OSD_CATERING_PLATFORM_V5_SPEC.md).
2. **Die App ist vollständig auf Deutsch** — die noch englischen Bereiche (u. a. Menüs-,
   Operations-Outputs, Settings, Import/Validation) sind durchgängig lokalisiert.

---

## Neu in V4.2 (Rechen-Engine + Dashboard)

V4.1 hat Mengen zwar konsistent aggregiert, aber **zwei Formelstufen gefehlt** und die Portionsbasis
geraten. V4.2 implementiert die vollständige Küchenformel und baut die Output-Screens zum
**Kitchen-Operations-Dashboard** um. Details: [`audit/CHANGELOG_V4.2.md`](audit/CHANGELOG_V4.2.md).

- **Produktionsverlust + Yield** sind jetzt im Engine: `recipes.production_loss_pct`, `recipes.yield_pct`
  (nullable, je Rezept überschreibbar; `NULL` → globaler Default **10 % / 80 %**).
- **Einheiten-Klassifizierung:** Verlust/Yield gelten **nur für Masse/Volumen**. Stück-Einheiten
  skalieren mit Pax (ohne Auf­schlag); „zum Abschmecken"-Einheiten (Geschmack, Bedarf, EL …) werden
  als **„n. Bedarf"** angezeigt statt als unsinnige Menge.
- **Eine Datenbasis:** Production & Purchasing entstehen aus **einem** Skalierungslauf — sie können
  nicht auseinanderlaufen.
- **UI:** dichtes, dunkles Dashboard mit Sticky-Summen und voller Nachvollziehbarkeit
  Netto → Produktion → Einkauf.

---

## Rechen-Engine (verbindliche Formel)

```
Netto-Bedarf      = Portionsmenge × Pax            (Portionsmenge = Rezeptmenge ÷ Portionsbasis)
Produktionsmenge  = Netto-Bedarf × (1 + Verlust %)        ← Production Factor
Einkaufsmenge     = Produktionsmenge ÷ Yield %
```

**Beispiel** (reproduziert in `npm test`):

```
100 Portionen × 150 g   = 15 kg     Netto-Bedarf
+ 10 % Produktionsverlust = 16,5 kg   Produktionsmenge
÷ 80 % Yield            = 20,625 kg  Einkaufsmenge
```

Verlust/Yield wirken nur auf Masse/Volumen. Stück-Mengen skalieren mit Pax; qualitative Einheiten
bleiben „n. Bedarf". Rezepte ohne hinterlegte Portionsbasis nutzen den Default **50** und werden im
UI als **„Annahme"** markiert (nicht still falsch).

---

## Kernworkflow

Production und Purchasing sind **keine getrennten Eingaben**, sondern Auswertungen **einer** Planung:

```
Verkaufte Menüs
  → Kitchen Production Batch   (Menüs + Pax — EINMALIGE Eingabe)
      → Rezeptaggregation       (gemeinsamer Aggregation-Service)
          → Production Output    (je Rezept skaliert: Netto → Produktion, Prep-Listen)
          → Purchasing Output    (Zutaten aggregiert: Netto → Produktion → Einkauf, nach Kategorie)
```

Events/Gästemanagement laufen **extern in Mouseclick** — hier wird je Batch nur *Menü + Pax* erfasst.

---

## Features

- **Stammdaten:** Einheiten, Zutaten, Rezepte (mit Zutaten + Verlust/Yield), Menüs (CRUD).
- **Menü ↔ Rezept-Verknüpfung:** Menüpositionen optional mit Rezepten verknüpfen (Such-/Code-Picker).
- **Kitchen Production Batch:** zentrale Planungseinheit (Menü + Pax) — die **einzige** Dateneingabe.
- **Production Output:** Produktionsmenge je Rezept (Netto × Verlustfaktor), Portionsbasis-Quelle
  (Yield / aus Notiz / Annahme), Sticky-Summen, „Kitchen Production Sheet" (Druck) + CSV.
- **Purchasing Output:** Zutaten aggregiert **nach Kategorie**, voll nachvollziehbar
  Netto → Produktion → Einkauf, Einheiten-Merge (kg→g, l→ml), „n. Bedarf" für qualitative Einheiten,
  „Purchasing Sheet" (Druck) + CSV.
- **Excel-Import-Engine:** Stammdaten-Import mit Validierung, Dry-Run und Logs.
- **Operations-Hilfen:** Import Center, Validierung, Data Quality, Settings (Schema-/Verbindungsstatus).

---

## Tech Stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind + shadcn/ui · TanStack Query ·
React Hook Form + Zod · Supabase / PostgreSQL (PostgREST) · xlsx · Lucide · Sonner.

---

## Schnellstart (Windows)

Doppelklick auf eine der Batch-Dateien im Projekt-Root:

| Datei | Zweck |
|---|---|
| **`start.bat`** | Produktions-Launcher: baut beim ersten Start, dann `next start` auf http://localhost:3000. |
| **`dev.bat`** | Entwicklungs-Launcher: `next dev` (Hot Reload) auf http://localhost:3000. |

Manuell (Cross-Platform):

```bash
npm install
npm run dev      # Entwicklung (Hot Reload), http://localhost:3000
# oder Produktion:
npm run build
npm run start
```

> Nicht `npm run build` ausführen, während der Dev-Server läuft — das überschreibt `.next` und
> bricht den Dev-Server (`missing required error components`). Erst Dev stoppen, dann bauen.

---

## Voraussetzungen

- **Node.js 18+** und npm
- Ein **Supabase-Projekt** (PostgreSQL + PostgREST)
- `.env.local` im Projekt-Root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co   # Browser + Server
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                      # Browser (RLS)
SUPABASE_SERVICE_ROLE_KEY=eyJ...                          # nur Server (Import, Health-Check)
```

> Die App hat **kein Login** — der Browser nutzt den **anon-Key**. RLS erlaubt anon CRUD auf die
> genutzten Tabellen. Für eine **öffentliche** Bereitstellung echtes Auth einführen.

---

## Datenbank & Migrationen

SQL-Migrationen liegen in [`supabase/migrations/`](supabase/migrations/) (additiv, chronologisch).

> ⚠️ Anon-/Service-Role-Keys sind PostgREST-JWTs und können **kein DDL**. Migrationen werden über den
> **Supabase SQL-Editor** ausgeführt. **Live-DB ≠ Repo-Migrationen** — Schema-Wahrheit ist die Live-DB
> bzw. Abschnitt 4.2 der V4-Spec.

V4.1/V4.2-relevante Migrationen:
`…0606000003` (kitchen_batches + kitchen_batch_items),
**`…20260613000001` (recipes.production_loss_pct + yield_pct — V4.2 Verlust/Yield)**.

---

## Tests

```bash
npm test         # node --test — Rechen-Engine (reproduziert das Spec-Beispiel + Aggregationsregeln)
```

10 Fälle u. a.: das Beispiel 15 kg → 16,5 kg → 20,625 kg, kg/g- & l/ml-Konvertierung,
Aggregation (5 kg + 2 kg = 7 kg), Verlust-/Yield-isoliert, Stück/qualitativ ohne Aufschlag,
„Annahme"-Markierung, gemeinsame Datenbasis von Production & Purchasing.

---

## Bedienung

1. **Stammdaten** pflegen oder per **Import Center** (Excel) laden.
2. **Menüs** anlegen und Positionen mit **Rezepten verknüpfen** (Master Data → Menus → Detail).
3. **Operations → Production Batches**: Batch anlegen, dann **Menüs + Pax einmal** eintragen.
4. **Operations → Production Output** bzw. **Purchasing Output**: Batch wählen → Auswertung,
   Druck-Sheet + CSV.

---

## Projektstruktur (Auszug)

```
app/(admin)/
  master-data/   units · ingredients · recipes · menus
  operations/    batches[/[id]] · production · purchasing · imports · validation · data-quality
  settings/
components/  layout · master-data · operations/output-ui · ui (shadcn)
hooks/       use-menus · use-recipes · use-ingredients · use-units · use-imports · use-batches
lib/
  purchasing/aggregate.ts        V4.2 Engine: Skalierung + Verlust/Yield + Einheiten-Klassen + Merge
  production/plan.ts              Produktionsmenge je Rezept (Netto × Verlustfaktor)
  operations/computeBatchOutputs.ts   gemeinsamer Aggregation-Service (eine Datenbasis → beide Outputs)
  importers/                     Excel-Import-Engine
services/    *.service.ts (batch, menus, recipes, ingredients, units, purchasing, imports)
types/       database.ts · index.ts
supabase/migrations/
tests/       calc.test.ts (npm test)
audit/       Audit-, Error- & Changelog-Reports + reproduzierbare Verifikations-Skripte
```

---

## NPM-Scripts

```bash
npm run dev          # Dev-Server (Turbopack, Hot Reload)
npm run build        # Produktions-Build
npm run start        # Produktionsserver
npm run type-check   # tsc --noEmit
npm test             # Rechen-Engine-Tests (node --test)
```

> Tipp: nach Code-Änderungen **immer auch `npm run build`** als finale Verifikation (fängt
> Next-only-Fehler ab). Dev-Server vorher stoppen.

---

## Bekannte Daten-Abhängigkeiten (ehrlich)

Die Logik ist vorhanden, greift aber erst mit den passenden Stammdaten:

- **Portionsbasis:** 17 Batch-Rezepte (alle `REC-00xx`) haben keine hinterlegte Basis → Default 50,
  im UI als **„Annahme"** markiert. Erfassungsbogen: `output/OSD_Portionsbasis_Eingabe.xlsx`.
- **Leere Rezepte:** 28 Rezepte (5 im aktuellen Batch) haben **keine Zutaten** → tragen nichts zu
  Produktion/Einkauf bei. Erfassungsbogen: `output/OSD_Fehlende_Zutaten.xlsx`.
- **Kosten & Lieferant** brauchen `supplier_products` — aktuell leer → Purchasing zeigt „—".
- **Kategorie-Gruppierung** nutzt `ingredients.category` — aktuell leer → eine Gruppe „Ohne Kategorie".

---

## Audit & Dokumentation

- [`audit/AUDIT_REPORT.md`](audit/AUDIT_REPORT.md) — Voll-Audit der Rechenpfade (Phasen 1–6)
- [`audit/ERROR_ANALYSIS.md`](audit/ERROR_ANALYSIS.md) — Fehler-Trace & Formel-Verifikation
- [`audit/CHANGELOG_V4.2.md`](audit/CHANGELOG_V4.2.md) — V4.2-Changelog
- [`audit/MIGRATION_NOTES_V4.2.md`](audit/MIGRATION_NOTES_V4.2.md) — Migrations-/Daten-Hinweise
- [`OSD_CATERING_PLATFORM_V4_SPEC.md`](OSD_CATERING_PLATFORM_V4_SPEC.md) — **autoritative** Spezifikation
- [`INSTALL.md`](INSTALL.md) — Installations-/Deployment-Hinweise

Die `audit/*.mjs|cjs`-Skripte sind reproduzierbar (read-only gegen die Live-DB bzw. die Export-CSVs).

---

*Internes Operations-Tool. Kein Login, anon-Key im Browser — nur für interne/lokale Nutzung gedacht.*
