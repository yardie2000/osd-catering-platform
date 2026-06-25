# OSD Catering Platform V5.1 Spec

Status: verbindliche Produktspezifikation fuer Release V5.1
Stand: 2026-06-26
System: produktive Catering-Kalkulations- und Kuechenplanungsplattform fuer OSD Event GmbH

## 1. Zielbild

OSD Catering Platform V5.1 ist eine ruhige, dunkle und touchfreundliche Kitchen-Operations-Konsole. Sie verbindet Stammdaten, Rezepte, Menues, Bedarf-Importe, Produktionslaeufe, Produktionslisten und Einkaufslisten in einem operativen Workflow.

Die Plattform beantwortet im Tagesbetrieb drei Fragen:

1. Welche Menues wurden fuer welchen Zeitraum und welche Pax geplant?
2. Welche Rezepte und Zutaten muessen daraus produziert werden?
3. Welche Einkaufsbedarfe ergeben sich daraus auf derselben Datenbasis?

## 2. Produktgrenzen

In Scope:

- Stammdatenpflege fuer Einheiten, Zutaten, Rezepte und Menues.
- Menuepositionen mit optionaler Rezeptverknuepfung.
- Rezeptzutaten mit Mengen, Einheiten, Notizen und Produktionsbasis.
- Importcenter fuer strukturierte Importdaten.
- Bedarf-Import aus MouseClick-/Produktbedarf-Exporten.
- Produktionslaeufe mit Menues und Pax.
- Produktionsausgabe aus Rezeptaggregation.
- Einkaufsausgabe aus derselben Aggregation.
- Lieferantenartikel als Zuordnungs- und Kalkulationsbasis.
- Datenqualitaet, Validierung, Lade-, Leer- und Fehlerzustaende.
- Docker/GitHub/Synology Deployment.

Out of Scope:

- CRM.
- Angebots- und Vertragsverwaltung.
- Vollstaendige Event- oder Personalplanung.
- Produktive Auth-/Rollenverwaltung, solange der Betrieb intern abgesichert ist.

## 3. Hauptnavigation

Alle Kernbereiche muessen direkt erreichbar sein:

- Dashboard
- Menues
- Rezepte
- Zutaten
- Einheiten
- Importcenter
- Validierung
- Datenqualitaet
- Bedarf-Import
- Produktionslaeufe
- Produktionsausgabe
- Einkaufsausgabe
- Einstellungen

Aktive Navigationszustaende muessen sichtbar sein. Mobile Navigation muss als vollwertige Navigation funktionieren und nach Navigation automatisch schliessen.

## 4. Datenmodell

Fuehrende Tabellen und Relationen:

- `units`: Einheiten, Mengentypen und Konversionsbasis.
- `ingredients`: Zutaten, Kategorie, Allergen-/Notizfelder und Standardeinheit.
- `recipes`: Rezeptkopf, Produktionsbasis, Yield, Verlust, Notizen.
- `recipe_ingredients`: Rezeptzutaten mit Menge, Einheit und optionalen Hinweisen.
- `menus`: Menuekopf fuer verkaufsnahe Planung.
- `menu_items`: Menuepositionen, optional mit `recipe_id`.
- `supplier_products`: Lieferantenartikel, Packung, Preis, Einheit und Lieferantenbezug.
- `kitchen_batches`: zentrale Planungseinheit fuer Zeitraum und Produktionslauf.
- `kitchen_batch_items`: Menue plus Pax je Produktionslauf.
- `import_jobs` und `data_import_log`: Importstatus und nachvollziehbare Logs.
- `purchasing_lists` und `purchasing_list_items`: persistierbare Einkaufslisten, soweit aktiviert.
- `production_batches`: Altbestand; nicht fuer neue zentrale Workflows fuehrend.

Die Live-Supabase-Datenbank ist fuer produktive Daten fuehrend. Repository-Migrationen muessen additiv sein und duerfen produktive Daten nicht still loeschen.

## 5. Berechnungsregeln

Production und Purchasing muessen aus demselben Produktionslauf entstehen.

```text
Netto-Bedarf      = Rezeptmenge pro Portion x Pax
Produktionsmenge  = Netto-Bedarf x (1 + Produktionsverlust)
Einkaufsmenge     = Produktionsmenge / Yield
```

Regeln:

- `base_portions` ist die bevorzugte Portionsbasis.
- Falls eine Portionsbasis fehlt, muss die UI die Annahme sichtbar machen.
- Verlust und Yield gelten fuer Masse und Volumen.
- Stueck-Einheiten skalieren ohne Verlust-/Yield-Aufschlag, sofern fachlich nicht anders gepflegt.
- Qualitative Einheiten bleiben Bedarfshinweise.
- kg/g und l/ml duerfen zusammengefuehrt werden.
- Production und Purchasing duerfen nicht aus unterschiedlichen Eingaben berechnet werden.

## 6. UI/UX Anforderungen

V5.1 muss auf 360px, 390px, 430px, 768px, 1024px, 1440px und breiten Desktop-Layouts benutzbar sein.

Pflicht:

- Mindest-Touch-Ziel ca. 44px.
- Keine abgeschnittenen Kerntexte.
- Kontrollierter Tabellen-Scroll nur dort, wo fachlich notwendig.
- Mobile Karten- oder Scrollmuster fuer lange Datenlisten.
- Deutliche Labels fuer kritische Aktionen wie Importieren, Loeschen, Berechnen, Ueberschreiben und Verknuepfen.
- Saubere Empty-, Loading- und Error-States.
- Formulare mit Labels, Fehlermeldungen und Tastaturbedienung.
- Kontrast im Dark-Gold-Theme muss fuer Kuechenumgebung lesbar bleiben.

## 7. Workflows

### Menue anlegen und pflegen

1. Menue erstellen.
2. Menuepositionen erfassen.
3. Optional Rezept pro Position verknuepfen.
4. Speichern und Detailansicht pruefen.

### Rezept anlegen und Zutaten verbinden

1. Rezeptkopf mit Portionsbasis erfassen.
2. Zutaten mit Menge und Einheit hinzufuegen.
3. Notizen, Yield und Verlust pflegen.
4. Rezept in Menueposition verwenden.

### Produktionslauf berechnen

1. Produktionslauf anlegen.
2. Menues und Pax erfassen.
3. Produktionsausgabe oeffnen.
4. Rezeptmengen und Zutatenlisten pruefen.

### Einkauf berechnen

1. Denselben Produktionslauf auswaehlen.
2. Einkaufsausgabe oeffnen.
3. Aggregierte Zutatenmengen pruefen.
4. Lieferantenartikel und Kosten sichtbar machen, sobald Daten gepflegt sind.

### Import verwenden

1. Datei oder Bedarfdaten importieren.
2. Validierung und Logs pruefen.
3. Unklare Zuordnungen sichtbar machen.
4. Keine stillen Fehler zulassen.

## 8. Supabase und Fehlerbehandlung

Jeder Supabase-Zugriff muss Lade-, Leer- und Fehlerzustand fachlich sichtbar machen. Fehler duerfen nicht nur in der Konsole landen.

Regeln:

- Keine Mockdaten in produktiven Screens.
- Keine hardcodierten produktiven Annahmen.
- Keine stillen Fallbacks, die Datenfehler verstecken.
- Query Keys muessen stabil sein.
- Mutationen muessen invalidieren, was die UI danach erneut braucht.
- Server-only Secrets duerfen nicht in Client Components verwendet werden.

## 9. Performance

- Grosse Listen muessen ohne Layoutbruch lesbar bleiben.
- Query-Caching soll wiederholtes Laden vermeiden.
- Client Components nur dort verwenden, wo Interaktion sie erfordert.
- Build-Artefakte, lokale Backups, alte Reports und generierte Exporte gehoeren nicht in das produktive Repository.

## 10. Deployment

Release nach Produktion laeuft ueber:

1. Merge nach `main`.
2. GitHub Actions Workflow `.github/workflows/docker-publish.yml`.
3. Docker Image `ghcr.io/yardie2000/osd-catering-platform:latest`.
4. Synology Watchtower aktualisiert den Container `osd-catering`.

Synology nutzt `docker-compose.synology.yml`. Produktive Credentials bleiben auf der Synology beziehungsweise in GitHub Variables/Secrets und werden nicht im Repository gespeichert.

## 11. Akzeptanzkriterien V5.1

- Paketversion ist `5.1.0`.
- Sichtbare Produktversion ist V5.1.
- Autoritative Spezifikation ist diese Datei.
- Alte Versionsspezifikationen und generierte Artefakte sind entfernt.
- TypeScript, Lint, Tests und Production Build laufen erfolgreich.
- Docker/GHCR/Synology-Workflow bleibt unveraendert funktionsfaehig.
- Keine produktiven Supabase-Credentials wurden geaendert.
