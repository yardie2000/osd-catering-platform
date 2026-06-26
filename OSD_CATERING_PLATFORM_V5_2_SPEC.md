# OSD Catering Platform V5.2 Spec

Status: verbindliche Produktspezifikation fuer Release V5.2
Stand: 2026-06-26
System: produktive Catering-Kalkulations- und Kuechenplanungsplattform fuer OSD Event GmbH

## 1. Zielbild

OSD Catering Platform V5.2 ist eine ruhige, dunkle und touchfreundliche Kitchen-Operations-Konsole. Sie verbindet Stammdaten, Rezepte, Menues, Menuepositionen, MouseClick-Bedarf-Importe, Review, Produktionslaeufe, Produktionslisten und Einkaufslisten in einem operativen Workflow.

Die Plattform beantwortet im Tagesbetrieb vier Fragen:

1. Welche Events und Pax wurden aus MouseClick importiert?
2. Welche verkauften Menues, erwarteten Positionsanzahlen und Kundenauswahlen gehoeren zu diesen Events?
3. Welche Rezepte und Zutaten muessen nach Review produziert werden?
4. Welche Einkaufsbedarfe ergeben sich daraus auf derselben Datenbasis?

## 2. Produktgrenzen

In Scope:

- Stammdatenpflege fuer Einheiten, Zutaten, Rezepte, Menues und Positionen.
- Geteilter Positionskatalog mit Menue-Zuordnung und Komponenten.
- Rezeptzutaten mit Mengen, Einheiten, Notizen und Produktionsbasis.
- Importcenter fuer strukturierte Importdaten.
- Bedarf-Import aus MouseClick-Produktbedarf-CSV.
- Rekonstruktion von Events, Pax, verkauftem Menue, erwarteter Positionsanzahl und Kundenauswahl.
- Review-Oberflaeche fuer importierte Events und ausgewaehlte Positionen.
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
- Positionen
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
- `positions`: geteilter Katalog verkaufbarer Menuepositionen.
- `menu_positions`: Zuordnung Menue zu Position.
- `position_components`: Komponenten einer Position, entweder Rezept oder direkte Zutat.
- `supplier_products`: Lieferantenartikel, Packung, Preis, Einheit und Lieferantenbezug.
- `import_jobs` und `data_import_log`: Importstatus und nachvollziehbare Logs.
- `imported_events`: aus MouseClick rekonstruierte Events.
- `imported_event_orders`: pro Event verkauftes Menue inklusive Pax und erwarteter Positionsanzahl aus dem Originaltext.
- `imported_event_selected_items`: ausschliesslich tatsaechlich gewaehlte Kundenpositionen.
- `kitchen_batches`: zentrale Planungseinheit fuer Zeitraum und Produktionslauf.
- `kitchen_batch_items`: Menue plus Pax je Produktionslauf.
- `purchasing_lists` und `purchasing_list_items`: persistierbare Einkaufslisten, soweit aktiviert.
- `production_batches`: Altbestand; nicht fuer neue zentrale Workflows fuehrend.

Die Live-Supabase-Datenbank ist fuer produktive Daten fuehrend. Repository-Migrationen muessen additiv sein und duerfen produktive Daten nicht still loeschen.

## 5. MouseClick-Produktbedarf-Import

Der Bedarf-Import trennt drei Datenebenen strikt:

1. Menuekatalog: Menues, auswählbare Positionen und Add-ons aus PDF/DB als Masterdaten.
2. Produktbedarf-CSV: konkrete Verkaufs- und Auftragsmomentaufnahme aus MouseClick.
3. Kundenauswahl: tatsaechlich bestellte Positionen innerhalb eines Menues.

Verbindliche Regeln:

- Der Import darf den Menuekatalog nicht veraendern.
- Eine Produktbedarfszeile darf mehrere Events enthalten und muss in einzelne `imported_events`/Orders zerlegt werden.
- Produktnamen werden gegen Menues gematcht, nicht gegen Rezepte oder Zutaten.
- Positionsanzahlen wie `3 Teile`, `4 Teile`, `5 Teile`, `6 Teile`, `8 Teile` und `9 Teile` muessen als Erwartungswert erkannt werden.
- Die Langbezeichnung wird gegen Positionen des gematchten Menues ausgewertet.
- Es duerfen nur erkannte oder manuell bestaetigte Kundenpositionen in `imported_event_selected_items` gespeichert werden.
- Nicht erkannte Positionen werden als Review-Items gespeichert und nicht verworfen.
- Unter 85 Prozent Confidence erfolgt keine automatische Freigabe.
- Abweichungen zwischen erwarteter Positionsanzahl und erkannter Auswahl erzeugen Review-Status, etwa 6 Teile mit nur 5 erkannten Positionen.
- Erst nach Review duerfen Produktions- und Einkaufsdaten berechnet werden.

Review-Funktionen:

- Eventname und Pax anzeigen.
- Menue und erwartete Positionsanzahl je Order pruefen.
- Positionen hinzufuegen, entfernen oder austauschen.
- Neue Positionen im Katalog anlegen und dem Menue zuordnen.
- Review-Zuordnung speichern.
- Status, Confidence, erkannte und nicht erkannte Positionen sichtbar machen.

## 6. Berechnungsregeln

Production und Purchasing muessen aus derselben geprueften Datenbasis entstehen.

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

## 7. UI/UX Anforderungen

V5.2 muss auf 360px, 390px, 430px, 768px, 1024px, 1440px und breiten Desktop-Layouts benutzbar sein.

Pflicht:

- Mindest-Touch-Ziel ca. 44px.
- Keine abgeschnittenen Kerntexte.
- Kontrollierter Tabellen-Scroll nur dort, wo fachlich notwendig.
- Mobile Karten- oder Scrollmuster fuer lange Datenlisten.
- Deutliche Labels fuer kritische Aktionen wie Importieren, Loeschen, Berechnen, Ueberschreiben, Verknuepfen und Review speichern.
- Saubere Empty-, Loading- und Error-States.
- Formulare mit Labels, Fehlermeldungen und Tastaturbedienung.
- Kontrast im Dark-Gold-Theme muss fuer Kuechenumgebung lesbar bleiben.

## 8. Workflows

### Menue anlegen und pflegen

1. Menue erstellen.
2. Menuepositionen aus dem Positionskatalog zuordnen.
3. Komponenten der Position pflegen.
4. Speichern und Detailansicht pruefen.

### Rezept anlegen und Zutaten verbinden

1. Rezeptkopf mit Portionsbasis erfassen.
2. Zutaten mit Menge und Einheit hinzufuegen.
3. Notizen, Yield und Verlust pflegen.
4. Rezept als Positionskomponente verwenden.

### MouseClick-Bedarf importieren

1. Produktbedarf-CSV hochladen.
2. Events und Orders automatisch rekonstruieren lassen.
3. Menues, erwartete Positionsanzahl und Kundenpositionen pruefen.
4. Unklare Positionen zuordnen oder neu anlegen.
5. Review speichern.
6. Erst danach Produktions- und Einkaufsberechnung ausloesen.

### Produktionslauf berechnen

1. Produktionslauf anlegen oder aus geprueftem Import ableiten.
2. Menues, Positionen und Pax erfassen oder uebernehmen.
3. Produktionsausgabe oeffnen.
4. Rezeptmengen und Zutatenlisten pruefen.

### Einkauf berechnen

1. Denselben geprueften Lauf auswaehlen.
2. Einkaufsausgabe oeffnen.
3. Aggregierte Zutatenmengen pruefen.
4. Lieferantenartikel und Kosten sichtbar machen, sobald Daten gepflegt sind.

## 9. Supabase und Fehlerbehandlung

Jeder Supabase-Zugriff muss Lade-, Leer- und Fehlerzustand fachlich sichtbar machen. Fehler duerfen nicht nur in der Konsole landen.

Regeln:

- Keine Mockdaten in produktiven Screens.
- Keine hardcodierten produktiven Annahmen.
- Keine stillen Fallbacks, die Datenfehler verstecken.
- Query Keys muessen stabil sein.
- Mutationen muessen invalidieren, was die UI danach erneut braucht.
- Server-only Secrets duerfen nicht in Client Components verwendet werden.
- Importfehler muessen nachvollziehbar bleiben und duerfen keine Daten verwerfen.

## 10. Performance

- Grosse Listen muessen ohne Layoutbruch lesbar bleiben.
- Query-Caching soll wiederholtes Laden vermeiden.
- Client Components nur dort verwenden, wo Interaktion sie erfordert.
- Build-Artefakte, lokale Backups, alte Reports und generierte Exporte gehoeren nicht in das produktive Repository.

## 11. Deployment

Release nach Produktion laeuft ueber:

1. Merge oder Push nach `main`.
2. GitHub Actions Workflow `.github/workflows/docker-publish.yml`.
3. Docker Image `ghcr.io/yardie2000/osd-catering-platform:latest`.
4. Synology Watchtower aktualisiert den Container `osd-catering`.

Synology nutzt `docker-compose.synology.yml`. Produktive Credentials bleiben auf der Synology beziehungsweise in GitHub Variables/Secrets und werden nicht im Repository gespeichert.

## 12. Akzeptanzkriterien V5.2

- Paketversion ist `5.2.1`.
- Sichtbare Produktversion ist V5.2.
- Autoritative Spezifikation ist diese Datei.
- Bedarf-Import speichert Events, Orders und Kundenauswahl in den neuen Importtabellen.
- Keine automatische Uebernahme aller Menuepositionen in Produktions- oder Einkaufsliste.
- Nicht erkannte Kundenauswahlen bleiben als `needs_review` erhalten.
- Review-Zuordnung kann gespeichert und erneut geladen werden.
- TypeScript, Tests und Production Build laufen erfolgreich.
- Docker/GHCR/Synology-Workflow bleibt funktionsfaehig.
- Keine produktiven Supabase-Credentials wurden geaendert.
