# UI/UX-, Responsiveness-, Daten- und Funktionsaudit

Stand: 2026-06-25

## Gefundene Seiten

- Dashboard: `/`
- Stammdaten: `/master-data/menus`, `/master-data/menus/[id]`, `/master-data/recipes`, `/master-data/recipes/new`, `/master-data/recipes/[id]`, `/master-data/recipes/[id]/edit`, `/master-data/ingredients`, `/master-data/ingredients/new`, `/master-data/ingredients/[id]`, `/master-data/ingredients/[id]/edit`, `/master-data/units`, `/master-data/units/new`, `/master-data/units/[id]`, `/master-data/units/[id]/edit`
- Operations: `/operations/imports`, `/operations/bedarf-import`, `/operations/batches`, `/operations/batches/[id]`, `/operations/production`, `/operations/purchasing`, `/operations/validation`, `/operations/data-quality`
- Einstellungen: `/settings`
- API: `/api/imports`, `/api/imports/[id]`

## Gefundene Komponenten

- Layout: `AppLayout`, `Sidebar`, `PageHeader`
- UI-Primitives: `Button`, `Input`, `Textarea`, `Select`, `Dialog`, `Card`, `Table`, `Badge`, `Separator`, `Label`
- Stammdaten: `IngredientForm`, `UnitForm`, `RecipeForm`, `MenuRecipePicker`, Menüpositions-Editor auf `/master-data/menus/[id]`
- Operations: `output-ui` mit `StickyBar`, `Stat`, `QtyCell`

## Gefundene Datenfluesse

- Supabase Client: `lib/supabase/client.ts`, Servercheck: `lib/supabase/server.ts`
- Hooks via TanStack Query: `useMenus`, `useIngredients`, `useRecipes`, `useUnits`, `useImports`, `useBatches`
- Stammdaten: `menus`, `menu_items`, `recipes`, `recipe_ingredients`, `ingredients`, `units`, `supplier_products`
- Produktionsplanung: `kitchen_batches` und `kitchen_batch_items`
- Ausgabe: `batchService.getOutputs` liest einen Kitchen Batch, laedt Menues fuer die Kalkulation, aggregiert Produktion und Einkauf ueber `computeBatchOutputs`
- Einkauf: `supplier_products` wird fuer Kosten und Lieferanteninformationen herangezogen; eine eigene Lieferanten-UI fehlt noch
- Import: Excel-Importcenter schreibt Importjobs/Logs; MouseClick-CSV erzeugt Kitchen Batches ueber Menu-Matching

## Priorisierte Probleme

### Kritisch

- Mobile Tabellen und lange Listen verlassen sich fast durchgehend auf generisches `overflow-x-auto`, ohne Mindestbreiten, Fokusrahmen oder mobile Hinweise. Risiko: unkontrollierte Quetschung, unentdeckte rechte Spalten, schlechte Bedienung auf 360px.
- Fehlerzustände aus TanStack Query werden auf vielen Seiten nicht sichtbar gerendert. Risiko: Supabase-/RLS-/Relationfehler wirken wie leere Daten oder "nicht gefunden".
- Lieferantenartikel sind datenfachlich nur ueber `supplier_products` und einzelne Zutatenfelder sichtbar, aber nicht als eigener Kernbereich erreichbar. Risiko: Lieferanten-Zuordnung ist fuer Einkauf nicht ausreichend auditierbar.
- Encoding-/Mojibake-Artefakte in einzelnen UI-/Metadata-Strings. Risiko: unprofessionelle Darstellung und missverstaendliche Labels.

### Hoch

- Touch-Ziele sind in Sidebar, Tabellenaktionen, Selects und kleinen Buttons teilweise unter 44px.
- Formulare verwenden auf kleinen Viewports mehrfach `grid-cols-2`/`grid-cols-3`; das fuehrt bei 360px zu engen oder abgeschnittenen Feldern.
- Icon-only Aktionen haben uneinheitliche `aria-label`s und verlassen sich teils nur auf `title`.
- Native `confirm()` Dialoge sind funktional, aber nicht konsistent mit dem shadcn/Radix-Dialogsystem und nicht gut lokalisierbar.
- Dashboard zeigt "in Kürze" fuer Einkaufs-/Events-Modul, obwohl Einkaufsausgabe produktiv implementiert ist.

### Mittel

- Detailseiten haben uneinheitliche Loading-/Empty-/Error-Darstellung.
- Tabellenzellen mit Codes, Beschreibungen und Badges haben uneinheitliche Zeilenhoehen und können bei langen Namen schwer scanbar werden.
- Operations-Output-Tabellen sind fachlich korrekt, aber mobile Scroll-Container und Sticky-Leisten brauchen bessere Breiten-/Wrap-Regeln.
- Data Quality prueft Stammdaten, aber Lieferantenartikel und Rezept-Zutaten-Abdeckung sind noch nicht vollstaendig integriert.

### Niedrig

- Mehrere deutsche Typografie- und Labeldetails koennen konsistenter werden.
- Einige Kommentare und Texte nutzen nicht einheitlich ASCII/Unicode; fuer Codekommentare ist das unkritisch, fuer UI sollte es sauber sein.

## Konkrete technische Massnahmen

- Gemeinsame UI-Primitives haerten: Button/Input/Select/Dialog/Table touchfreundlicher, mobiler und fokussierbarer machen.
- Gemeinsame Zustandskomponenten fuer Loading, Empty und Error einfuehren und in Kernseiten nutzen.
- Tabellen mit kontrollierter Mindestbreite, scrollbarer Region, `tabIndex=0` und mobilem Scroll-Hinweis ausstatten.
- PageHeader und Inhaltsabstaende mobile-first anpassen.
- Sidebar-Navigation mobil groesser, klare aktive States, Encoding korrigieren.
- Dashboard-Status an reale Module anpassen und Kernworkflows deutlicher verlinken.
- Kernlisten und Detailseiten um sichtbare Query-Fehler und bessere leere Zustaende ergaenzen.
- Rezept-/Zutaten-/Menu-/Batch-Formulare auf `grid-cols-1 sm:grid-cols-*` umstellen.
- Operations-Outputs fuer mobile Scrollbarkeit, Fehlerdarstellung und klare Warnungen verbessern.
- QA-Checkliste fuer 360/390/430/768/1024/1440/grosse Desktopbreiten dokumentieren.

## Offene strukturelle Punkte nach Code-Härtung

- Eigene Lieferanten-/Supplier-Products-Verwaltung fehlt als Hauptbereich.
- Radix AlertDialog fuer destruktive Aktionen sollte als naechster gezielter Refactor die nativen `confirm()` Aufrufe ersetzen.
- Vollstaendige visuelle QA auf echten Supabase-Daten muss in der Produktionsumgebung oder mit Seed-Daten wiederholt werden.
