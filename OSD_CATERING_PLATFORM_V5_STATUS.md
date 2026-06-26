# OSD Catering - V5.2 Status & Release Notes

Stand: 2026-06-26
App-Version: 5.2.0
Branch: main
Deployment: GitHub Actions -> GHCR -> Synology Watchtower

Zugehoerige Specs:

- [V5.2 Produktspezifikation](OSD_CATERING_PLATFORM_V5_2_SPEC.md)
- [Positionen](OSD_CATERING_PLATFORM_POSITIONEN_SPEC.md)
- [Komponenten](OSD_CATERING_PLATFORM_KOMPONENTEN_SPEC.md)

## 1. Release-Ziel V5.2

V5.2 korrigiert den fachlichen MouseClick-Produktbedarfimport. Der Import behandelt die CSV nicht mehr als Menuekatalog und erzeugt keine Produktionsdaten aus allen Positionen eines Menues.

Neue fachliche Kette:

```text
CSV
  -> Parser
  -> Events
  -> verkauftes Menue
  -> Menuevariante
  -> tatsaechlich gewaehlte Kundenpositionen
  -> Review
  -> Rezepte
  -> Produktion
  -> Einkauf
```

## 2. Fertig in V5.2

- Additive Supabase-Migration fuer:
  - `imported_events`
  - `imported_event_orders`
  - `imported_event_selected_items`
- Pure Import-Pipeline in `lib/produktbedarf/importPipeline.ts`.
- MouseClick-Auftrags-Splitting: eine CSV-Zeile kann mehrere Events erzeugen.
- Menue-Matching gegen `menus`, nicht gegen Rezepte oder Zutaten.
- Varianten-Erkennung fuer Teile-Varianten und Betriebsformen wie Lunch, Grab and Go, BBQ, Family Style und Buffet.
- Positions-Rekonstruktion aus der Langbezeichnung gegen `positions` des gematchten Menues.
- Explizite Review-Items fuer nicht erkannte oder fehlende Positionen.
- API-Route `/api/product-demand-import` fuer Import, Laden und Speichern der Review-Daten.
- Neue Review-Oberflaeche unter `/operations/bedarf-import`.
- Review-Funktionen:
  - Menue aendern
  - Variante aendern
  - Pax korrigieren
  - Position hinzufuegen
  - Position entfernen
  - Position austauschen
  - neue Position anlegen und dem Menue zuordnen
  - Zuordnung speichern
- Tests fuer Parser, Event-Splitting, Menue-/Variantenmatching, Positionsauswahl und Review-Status.

## 3. Datenmodell-Hierarchie

Aktiver Masterkatalog:

```text
Menue -> menu_positions -> positions -> position_components -> recipe/ingredient -> recipe_ingredients -> ingredient
```

Importierte Verkaufsdaten:

```text
imported_events
  -> imported_event_orders
    -> imported_event_selected_items
```

Wichtig: `imported_event_selected_items` enthaelt ausschliesslich tatsaechlich erkannte oder manuell bestaetigte Kundenpositionen. Diese Tabelle darf nicht aus allen Positionen eines Menues automatisch befuellt werden.

## 4. Migrationen

Neu fuer V5.2:

- `supabase/migrations/20260626000001_imported_event_orders.sql`

Die Migration ist additiv und veraendert keine Masterdaten.

Vor produktiver Nutzung muss diese Migration in der Live-Supabase-Datenbank ausgefuehrt sein. Ohne diese Tabellen kann die Review-API nicht persistieren.

## 5. Verifikation

Lokal erfolgreich:

- `npm test` -> 72 Tests gruen
- `npm run type-check` -> gruen
- Smoke-Test `/operations/bedarf-import` -> HTTP 200
- Smoke-Test `/api/product-demand-import` ohne `jobId` -> erwarteter HTTP 400
- Real-CSV-Analyse mit `Produktbedarf_2026-06-26_03-21-06.csv`:
  - 69 CSV-Zeilen
  - 63 rekonstruierte Events
  - 187 importierte Event-Orders

Beispiel Fingerfood 6 Teile:

- Menue: `FINGERFOOD ABENDS`
- Variante: `6 Teile`
- erkannte Positionen: 5
- fehlende Position: explizites Review-Item
- Status: `needs_review`

## 6. Deployment

Produktionsweg:

1. Push nach `main`.
2. GitHub Actions baut und pusht:
   - `ghcr.io/yardie2000/osd-catering-platform:latest`
   - `ghcr.io/yardie2000/osd-catering-platform:<git-sha>`
3. Synology Watchtower zieht automatisch das neue `latest`-Image.
4. Container `osd-catering` wird ersetzt.

Synology Compose:

- `docker-compose.synology.yml`
- App-Container: `osd-catering`
- Tunnel-Container: `osd-cloudflared`
- Watchtower: `osd-watchtower`

## 7. Offene operative Schritte

- V5.2-Migration in Live-Supabase ausfuehren, falls noch nicht angewendet.
- GitHub Actions Lauf nach Push pruefen.
- Synology Watchtower-Logs pruefen oder Container manuell neu ziehen, falls das Update nicht innerhalb von 5 Minuten kommt.
- Danach Import im Browser unter `/operations/bedarf-import` mit der echten CSV testen und Review speichern.

## 8. Sicherheit

- Keine produktiven Supabase-Credentials wurden im Repository gespeichert.
- `.env.local` bleibt gitignored.
- Die App bleibt ein internes Operations-Tool ohne produktive Auth-Schicht.
