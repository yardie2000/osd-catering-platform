# Responsive QA Checklist

Stand: 2026-06-25

## Mobile

- [ ] 360px: Sidebar oeffnet/schliesst, aktive Route sichtbar, keine abgeschnittenen Hauptaktionen.
- [ ] 390px: Dashboard Cards umbrechen sauber, Import-/Batch-Aktionen bleiben bedienbar.
- [ ] 430px: Tabellen zeigen kontrollierten horizontalen Scroll statt Layoutbruch.
- [ ] Touch-Ziele fuer Buttons, Icon-Buttons, Selects, Tabs und Uploadbereiche sind ca. 44px hoch.
- [ ] Dialoge nutzen maximal die Viewporthoehe und scrollen intern.
- [ ] Formularfelder stehen einspaltig, Fehlermeldungen bleiben sichtbar.

## Tablet

- [ ] 768px: Sidebar/Desktop-Umschaltung funktioniert ohne Overlay-Reste.
- [ ] 1024px: Tabellen, Cards und Formulargrids nutzen den Platz, ohne ueberladen zu wirken.
- [ ] Sticky Bars in Produktion/Einkauf verdecken keine Inhalte.
- [ ] Filterbars bleiben in sinnvoller Reihenfolge und ohne horizontale Brueche nutzbar.

## Desktop

- [ ] 1440px: Dashboard, Stammdatenlisten und Operationsseiten wirken ruhig, dicht und scanbar.
- [ ] Grosse Desktop-Breiten: Inhaltsbreiten bleiben kontrolliert, keine extrem langen Leselinien in Formularen.
- [ ] Tabellenaktionen sind rechts stabil ausgerichtet.
- [ ] Kernmodule sind ueber Sidebar ohne versteckte Workflows erreichbar.

## Navigation

- [ ] Aktive Sidebar-Zustaende sind sichtbar.
- [ ] Mobile Overlay schliesst per X, Route-Klick und Hintergrund.
- [ ] Detailseiten haben klare Zurueck- und Bearbeiten-Aktionen.
- [ ] Produktion und Einkauf verlinken zum zugrunde liegenden Produktionslauf.

## Tabellen

- [ ] Jede Tabelle hat kontrollierten horizontalen Scroll bei kleinen Viewports.
- [ ] Codes, Preise, Mengen, Einheiten und Badges bleiben lesbar.
- [ ] Empty States benennen die naechste sinnvolle Aktion.
- [ ] Loading States sind unterscheidbar von leeren Daten.
- [ ] Supabase-/Query-Fehler werden sichtbar angezeigt.

## Formulare

- [ ] Pflichtfelder sind gelabelt und Fehlermeldungen stehen direkt am Feld.
- [ ] Mobile Layouts sind einspaltig.
- [ ] Checkboxen und Allergenen-Chips sind touchfreundlich.
- [ ] Save/Cancel-Reihenfolge ist auf Mobile und Desktop konsistent.
- [ ] Zahlenfelder fuer Portionen, Preise, Mengen und Prozentwerte akzeptieren sinnvolle Eingaben.

## Modals

- [ ] Dialoge passen in 360px Breite.
- [ ] Lange Dialoge scrollen ohne Header/Close unbedienbar zu machen.
- [ ] Close-Buttons haben Screenreader-Text.
- [ ] Destruktive Aktionen zeigen klare Labels.

## Datenintegritaet

- [ ] Zutatenliste zeigt alle sichtbaren Zutaten inklusive Einheit, Lieferant, Allergenen.
- [ ] Rezepte zeigen Rezept-Zutaten, Mengen, Einheiten und Lieferantenhinweise.
- [ ] Menues zeigen Positionen und Komponentenbezug.
- [ ] Produktionslauf nutzt Menues + Personenzahl als einzige Eingabequelle.
- [ ] Produktion und Einkauf werden aus demselben Batch berechnet.
- [ ] Einkauf zeigt Lieferant/Kosten, wenn `supplier_products` Daten vorhanden sind.

## Supabase-Flows

- [ ] Listenabfragen zeigen Fehler, Loading und Empty getrennt.
- [ ] Detailabfragen zeigen nicht faelschlich "nicht gefunden", wenn ein Query-Fehler vorliegt.
- [ ] Mutationen invalidieren betroffene Query Keys.
- [ ] Importjobs und Importlogs bleiben nach Upload nachvollziehbar.
- [ ] Keine produktiven Credentials werden geaendert oder ausgegeben.
