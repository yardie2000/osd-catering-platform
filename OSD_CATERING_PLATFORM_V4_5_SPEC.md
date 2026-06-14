# OSD Catering Calculation Platform – README V4.5

## Überblick

Die OSD Catering Calculation Platform ist eine spezialisierte operative Kalkulations- und Produktionsplattform für Cateringbetriebe. Sie ist **kein** CRM, **kein** Angebots- oder Eventmanagement-System und **kein** Personalplanungstool. Stattdessen fungiert sie als operative Middleware zwischen bestehenden Systemen wie Mausclick und CrewBrain und übersetzt verkaufte Menüs in Küchenlogik, Mengenberechnung, Produktionsplanung und Einkaufsbedarf.

Der Kernworkflow lautet:

**Verkaufte Menüs / Eventdaten → Menüzuordnung → Rezepte → Zutaten → Produktionsmengen → Einkaufsbedarf**

Die Plattform ist auf produktionsnahe, skalierbare Küchenprozesse ausgerichtet und soll für mehrere hundert Veranstaltungen pro Jahr belastbar sein.

---

## Ziel von Version 4.5

Version 4.5 ist der Übergang von einer allgemeinen Datenstruktur zu einem fachlich saubereren operativen Kalkulationsmodell. Der Fokus der letzten Änderungen lag auf:

- Vereinheitlichung der Rezeptstruktur.
- Umstellung auf fachlich klarere Feldnamen im Recipe-Bereich.
- Vorbereitung einer stabilen Portions-, Yield- und Produktionslogik.
- Konsolidierung des TypeScript-Typings für Supabase.
- Vereinheitlichung von Services, Hooks und Admin-Seiten im Master-Data-Bereich.
- Schaffung einer besseren Basis für die nächsten Schritte in Richtung V5.0.

---

## Bereits umgesetzte Änderungen in V4.5

### 1. Rezeptschema fachlich vereinheitlicht

Die Rezeptstruktur wurde auf eine neue kanonische Benennung umgestellt.

### Alt → Neu

- `baseportions` → `base_portions`
- `basequantity` → `yield_quantity`
- `baseunitid` → `yield_unit_id`
- `yieldpct` → `yield_pct`
- `productionlosspct` → `production_loss_pct`

Diese Umstellung ist fachlich wichtig, weil dadurch klarer zwischen folgenden Ebenen unterschieden wird:

- **Basisportionen** = Wie viele Portionen ein Rezept standardmäßig abbildet.
- **Ertrag / Yield Quantity** = Welche Gesamtmenge das Rezept ergibt.
- **Yield %** = Welche Ausbeute im Produktionsprozess erreicht wird.
- **Production Loss %** = Welche zusätzlichen Verluste im Prozess entstehen.

---

### 2. Neue Typbasis für `database.ts`

Die Typdefinitionen wurden auf das neue Schema ausgerichtet.

Wesentliche Punkte:

- Vollständige Tabellenstruktur für `units`, `ingredients`, `recipes`, `recipe_ingredients`, `menus`, `menu_items`, `supplier_products`, `import_jobs`, `data_import_log`, `purchasing_lists`, `purchasing_list_items`, `production_batches`, `kitchen_batches`, `kitchen_batch_items`.
- Typisierte Beziehungen für Supabase Foreign Keys.
- Einführung fachlich präziserer Typen wie:
  - `Recipe`
  - `RecipeInsert`
  - `RecipeUpdate`
  - `RecipeWithDetails`
  - `IngredientWithUnit`
  - `MenuWithItems`
- Vorbereitung deutscher und fachlich sinnvoller Status-/Typfelder, etwa bei `menu_items`.

---

### 3. Yield-/Loss-Migration eingeführt

Es wurde eine Migration eingeführt, die `yield_pct` und `production_loss_pct` auf Rezeptbasis ergänzt bzw. vereinheitlicht.

Ziel dieser Änderung:

- mathematische Konsistenz in der Portionslogik,
- saubere Berechnung von Netto-Bedarf, Produktionsmenge und Einkaufsmenge,
- Vorbereitung professioneller Catering-Kalkulation.

Grundlogik:

1. Netto-Bedarf = Portionenzahl × Portionsmenge
2. Produktionsmenge = Netto-Bedarf × \(1 + Verlust\)
3. Einkaufsmenge = Produktionsmenge ÷ Yield

---

### 4. Recipe Service neu aufgebaut

`services/recipes.service.ts` wurde auf den neuen Schema-Stand angepasst.

Aktueller Stand:

- `getAll()` für Listenabruf mit Suchoptionen.
- `getById()` inklusive `yield_unit` und `recipe_ingredients` Relation.
- `getByCode()`.
- `create()` / `update()` / `delete()`.
- `upsertIngredients()` für Zutatensätze pro Rezept.
- `scaleRecipe()` auf Basis von `base_portions`, `yield_quantity` und Zutatenmengen.
- `getAllergens()` über die Rezeptzutaten.

---

### 5. React-Query Hooks für Rezepte überarbeitet

`hooks/use-recipes.ts` wurde vereinheitlicht.

Enthalten:

- `useRecipes()`
- `useRecipe()`
- `useRecipeAllergens()`
- `useCreateRecipe()`
- `useUpdateRecipe()`
- `useDeleteRecipe()`

Die Mutations invalidieren die zugehörigen Query Keys nach erfolgreicher Mutation, was dem empfohlenen TanStack-Query-Muster entspricht.[cite:157]

---

### 6. Rezeptseiten im Admin-Bereich neu strukturiert

Folgende Seiten wurden fachlich und technisch auf den neuen Stand umgestellt:

- Rezeptliste
- Rezeptdetailseite
- Neues Rezept
- Rezept bearbeiten

Die Seiten wurden auf folgende fachliche Felder ausgerichtet:

- Rezeptcode
- Name
- Basisportionen
- Ertrag
- Ertragseinheit
- Produktionsverlust
- Ausbeute
- Skalierbarkeit
- Haltbarkeit
- Zubereitung
- Verwendungshinweise
- Produktionshinweise
- Zutaten

---

### 7. Wiederverwendbare `RecipeForm` eingeführt

Zur Reduzierung von Duplikaten wurde eine gemeinsame Formular-Komponente vorbereitet bzw. eingeführt:

- `components/recipes/recipe-form.tsx`

Vorteile:

- New/Edit verwenden dieselbe Validierungslogik.
- Einheitliches Feldverhalten.
- Weniger Pflegeaufwand.
- Geringeres Risiko von Schema-Abweichungen.

Die Umsetzung orientiert sich an typischen React-Hook-Form-/Zod-/shadcn-Mustern mit kontrollierten Selects und `useFieldArray` für dynamische Felder.[cite:142]

---

### 8. Ingredients- und Units-Layer ergänzt

Für die nächsten Schritte wurden vollständige Service- und Hook-Layer ergänzt:

#### Ingredients
- `services/ingredients.service.ts`
- `hooks/use-ingredients.ts`

#### Units
- `services/units.service.ts`
- `hooks/use-units.ts`

Diese Schicht bringt:

- Listen- und Detailabruf,
- Create / Update / Delete,
- Filteroptionen,
- React-Query-Invalidierung,
- wiederverwendbare Master-Data-Standards.

---

## Aktuelle Architektur nach V4.5

### Frontend

- Next.js 15
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- TanStack Query

### Backend

- Supabase
- PostgreSQL
- Supabase Auth
- Row Level Security

### Systemrolle

Die Plattform bleibt bewusst eine **operative Catering-Engine** und ersetzt weiterhin nicht:

- CRM
- Angebotswesen
- Verkauf
- Eventmanagement
- Personalplanung
- Kalender- oder Crew-Management

---

## Wichtige fachliche Modelllogik in V4.5

### Rezeptbasis

Ein Rezept braucht künftig fachlich eine klar definierte Bezugsgröße:

- `base_portions`
- `yield_quantity`
- `yield_unit_id`
- `yield_pct`
- `production_loss_pct`

Diese Felder sind die Grundlage für:

- Produktionsskalierung,
- Mengenaggregation,
- Einkaufsberechnung,
- Kitchen-Batch-Logik.

### Trennung von Menü und Rezept

Die Plattform folgt weiterhin dem Modell:

**Menü → Menüpositionen → Rezept → Zutaten**

Das ist fachlich korrekt, weil Menüs verkaufsnah bleiben und Rezepte produktionsnah modelliert werden.

### Produktionssicht

Mit `kitchen_batches` und `kitchen_batch_items` wird die Plattform schrittweise auf produktionszeitraumbezogene Planung ausgerichtet statt nur auf einfache Einzellose.

---

## Was noch nicht abgeschlossen ist

Trotz der Fortschritte ist Version 4.5 noch **kein finaler Produktionsstand**. Die wichtigsten offenen Punkte sind:

### Fachlich offen

- Pflichtlogik für vollständige Rezeptbasis noch nicht überall erzwungen.
- Prüfung, ob Rezepte ohne Basisportion bzw. Ertrag speicherbar sind.
- Vollständige UI-Lokalisierung auf Deutsch noch nicht abgeschlossen.
- Menütypen, Produktionsrelevanz und Zuordnungslogik müssen weiter geschärft werden.

### Technisch offen

- End-to-End-Kompilierung aller neuen Dateien prüfen.
- Importpfade und Typ-Reexports validieren.
- Konsistenz zwischen altem und neuem Batch-Modell prüfen.
- Ingredients-/Units-Admin-Seiten noch fertigstellen.
- Tests an neue Feldnamen anpassen.
- RLS und Rechtekonzept vor produktivem Betrieb härten.

### Betrieblich offen

- Mausclick-Mapping noch nicht vollständig operationalisiert.
- Importprüfung / Matching-Zentrale noch nicht fertig.
- Lieferanten- und Bestelllogik noch nicht vollständig professionell umgesetzt.

---

## Empfohlene nächsten Schritte nach V4.5

### Priorität 1 – technische Konsolidierung

1. Alle manuell erzeugten Dateien gegen den realen Codebestand prüfen.
2. Importpfade, Typimporte und Alias-Auflösung validieren.
3. TypeScript-Fehler, Build-Fehler und Lint-Fehler beseitigen.
4. Doppelte oder widersprüchliche Formularimplementierungen bereinigen.

### Priorität 2 – Master Data vervollständigen

1. Ingredients-Seiten fertigstellen.
2. Units-Seiten fertigstellen.
3. Einheitliche deutsche Labels einziehen.
4. Validierungsregeln für Pflichtfelder konsequent vereinheitlichen.

### Priorität 3 – Fachlogik absichern

1. Pflichtlogik für Rezeptbasis einführen.
2. Yield-/Loss-Rechenkette in Tests absichern.
3. Menü-zu-Rezept-Zuordnung fachlich härten.
4. Produktions- und Einkaufslogik mit realen Cateringfällen testen.

### Priorität 4 – Richtung V5.0

1. Import Review / Matching Center bauen.
2. Kitchen Period / Produktionszeitraum sauber im UI verankern.
3. Lieferantenartikel und Bestelllogik professionalisieren.
4. Rollen- und Rechtekonzept für echten Produktivbetrieb umsetzen.

---

## Kurzfazit

Version 4.5 markiert einen wichtigen fachlichen Umbau: weg von einer eher generischen Rezeptdatenstruktur hin zu einer deutlich professionelleren Catering-Kalkulationsbasis. Besonders wichtig sind die neue Rezeptfeldlogik, die Überarbeitung des Service-/Hook-Layers und die Vorbereitung einer konsistenten Produktionsmathematik.

Die nächsten Schritte müssen sich jetzt auf **Validierung, Konsolidierung, UI-Vervollständigung und fachliche Härtung** konzentrieren.
