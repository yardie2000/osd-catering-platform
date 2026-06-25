# OSD Catering Platform V5.1

Operative Catering-Kalkulations- und Kuechenplanungsplattform fuer OSD Event GmbH.

Die App verwaltet Stammdaten, Rezepte, Menues, Produktionslaeufe, Importdaten und Einkaufsbedarfe. Aus verkauften Menues und Gaestezahlen entstehen nachvollziehbare Produktions- und Einkaufslisten auf derselben Berechnungsbasis.

Autoritative Spezifikation: [OSD_CATERING_PLATFORM_V5_1_SPEC.md](OSD_CATERING_PLATFORM_V5_1_SPEC.md)

## Status

Release: V5.1
Package: `osd-catering-platform@5.1.0`
Deployment: GitHub Actions baut das Docker-Image und veroeffentlicht es in GHCR; Synology aktualisiert den Container per Watchtower.

## Kernmodule

- Dashboard fuer Betriebsueberblick und schnelle Navigation.
- Stammdaten: Einheiten, Zutaten, Rezepte, Menues.
- Menuepositionen mit Rezeptverknuepfung.
- Importcenter fuer Excel- und Bedarf-Importe.
- Validierung und Datenqualitaet.
- Produktionslaeufe mit Menue- und Pax-Eingabe.
- Produktionsausgabe aus Rezeptaggregation.
- Einkaufsausgabe aus denselben Bedarfsdaten.
- Lieferantenartikel als Grundlage fuer Kosten- und Einkaufslogik.
- Settings mit Supabase- und Schema-Status.

## Rechenlogik

Production und Purchasing sind keine getrennten Eingaben. Beide Ausgaben entstehen aus einem Produktionslauf.

```text
Verkaufte Menues
  -> Produktionslauf mit Menue + Pax
    -> Rezeptaggregation
      -> Produktionsausgabe
      -> Einkaufsausgabe
```

Verbindliche Formel:

```text
Netto-Bedarf      = Portionsmenge x Pax
Produktionsmenge  = Netto-Bedarf x (1 + Produktionsverlust)
Einkaufsmenge     = Produktionsmenge / Yield
```

Verlust und Yield wirken auf Masse und Volumen. Stueck-Einheiten skalieren direkt mit Pax. Qualitative Einheiten werden als Bedarfshinweis behandelt.

## Tech Stack

- Next.js 15 App Router
- React
- TypeScript strict
- TailwindCSS und shadcn/ui
- TanStack Query
- Supabase/PostgreSQL
- Docker, GHCR, Synology Container Manager, Watchtower

## Entwicklung

```bash
npm install
npm run dev
```

Produktion lokal:

```bash
npm run build
npm run start
```

Qualitaetssicherung:

```bash
npm run type-check
npm run lint
npm test
npm run build
```

## Deployment

Merge nach `main` startet `.github/workflows/docker-publish.yml`.

Der Workflow:

1. baut das Produktions-Docker-Image,
2. pusht `ghcr.io/yardie2000/osd-catering-platform:latest`,
3. pusht zusaetzlich ein SHA-getaggtes Image,
4. Synology Watchtower zieht automatisch das neue `latest`-Image und ersetzt den App-Container.

Synology-Compose-Referenz: [docker-compose.synology.yml](docker-compose.synology.yml)

## Environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Die produktiven Credentials werden nicht im Repository gespeichert.

## Projektstruktur

```text
app/                 Next.js App Router, Pages, API Routes
components/          Layout, Forms, Tabellen, UI-Komponenten
hooks/               TanStack Query Hooks
lib/                 Berechnung, Import, Supabase, Utilities
providers/           App Provider
services/            Supabase-Datenzugriffe
supabase/migrations/ Additive Datenbankmigrationen
tests/               Rechen- und Importtests
types/               Domain- und Datenbanktypen
```

## Datenwahrheit

Die Live-Supabase-Datenbank ist fuer produktive Daten und tatsaechliche Relationen fuehrend. Migrationen im Repository dokumentieren und erweitern das Schema additiv. Keine Migration darf produktive Daten loeschen, ohne vorher explizit geplant und gesichert zu sein.

## Scope

Die Plattform ist ein internes Operations-Tool fuer Catering-Kalkulation, Kuechenplanung und Einkaufsableitung. Sie ist kein CRM, kein Angebotsmanagement und kein vollstaendiges Eventmanagement-System.
