# Audit & Umsetzung — Teil 1: Datenmodell-Fix (Rezepte → Zutaten)

Stand: 2026-06-27 · Block 1 von 11 des Workflow-Audits
„Position → Komponenten → Rezept/Zutat → Einkauf → Produktion"

---

## 1. Befund (Audit)

Beim PDF-Katalog-Import (Migration `20260626000003_pdf_catalog_addons_recipe_stubs.sql`)
wurden reine **Zutaten als Rezept-Stubs** angelegt. Betroffen sind u. a.:

| Falsch als Rezept | recipe_code |
|---|---|
| Burrata | `PDF-STUB-BURRATA` |
| Parmesan | `PDF-STUB-PARMESAN` |
| Romana Salatherzen | `PDF-STUB-ROMANA` |
| Frühlingszwiebel | `PDF-STUB-FRUEHLINGSZWIEBEL` |
| Süßkartoffelspalten | `PDF-STUB-SUESSKARTOFFEL` |
| Poulardenbrust (zugekauft) | `PDF-STUB-POULARDE` |
| Kabeljau (zugekauft) | `PDF-STUB-KABELJAU` |
| Gegrilltes Hähnchen | `PDF-STUB-GEGRILLTES-HAEHNCHEN` |
| Hähnchen für Caesar Salad | `PDF-STUB-CAESAR-CHICKEN` |
| Buntes Gemüse | `PDF-STUB-BUNTES-GEMUESE` |

Fachlich sind das **keine Rezepte** (keine Zutatenliste, kein Yield, kein
Produktionsschritt, keine Portionsbasis), sondern **zugekaufte/rohe Zutaten**.
Sie verfälschen die zweistufige Vorproduktions-Aggregation (`computeBatchOutputs`):
eine „Burrata" würde als vorzuproduzierendes Rezept gezählt statt als Einkaufsposition.

**Bewusst Rezept geblieben** (Zubereitung / zusammengesetztes Gericht): `PDF-STUB-JUS`,
`PDF-STUB-TERIYAKI` (Teriyaki Sauce), `PDF-STUB-OFENGEMUESE-LABNEH`, `PDF-STUB-CEVICHE`,
`PDF-STUB-ROASTBEEF-SENFSAUCE`, `PDF-STUB-SEITAN-PAKCHOI-SESAM`, `PDF-STUB-PIMIENTO-*`,
`PDF-STUB-COLESLAW-KRAEUTERQUARK`, `PDF-STUB-CHILI-SIN-CON-CARNE`, `PDF-STUB-SALAT-ODER-SUPPE`.

## 2. Heuristik „Rezept ist in Wahrheit eine Zutat"

Ein Datensatz wird konvertiert, wenn **alle** Bedingungen zutreffen:

1. stammt aus Import/Review — `needs_review = true` **oder** `recipe_status = 'incomplete'`
   **oder** `recipe_code LIKE 'PDF-STUB-%'`. (Handgepflegte aktive Rezepte bleiben unangetastet.)
2. besitzt **keine** Rezeptzutaten (`recipe_ingredients = 0`),
3. besitzt **kein** Yield (`yield_quantity IS NULL`),
4. besitzt **keinen** Produktionsschritt (`preparation` leer),
5. Name ist **kein** zusammengesetztes Gericht (kein `|`-Trenner),
6. Name ist **keine** Zubereitung (Sauce, Jus, Dressing, Püree, Pesto, Aioli, Mayonnaise,
   Fond, Beurre, Vinaigrette, Gremolata, Marinade, Quark, Sugo, Chutney, Relish, Kompott,
   Confit, Suppe, „Salat oder …").

Die Heuristik ist **datengetrieben** (nicht auf die PDF-Stubs hartcodiert) und erfasst damit
auch künftig fälschlich importierte Zutaten (z. B. Feta, Tomate, Rucola, Bacon …), sofern sie
dieselbe Signatur tragen.

## 3. Umsetzung — reversibel & additiv

Vorgehen pro Treffer (in der Migration in 3 Schritten):

1. **Echte Zutat anlegen** — `ingredients`-Zeile, `ingredient_code = 'ZUT-' || <Stub-Suffix>`,
   Kategorie `PDF-Import (auto)`, Herkunftsnotiz. Name vom Zusatz „(PDF-Komponente)" bereinigt.
2. **Referenzen umhängen** — alle `position_components`, die auf das Rezept zeigten, zeigen
   anschließend auf die neue Zutat (`recipe_id → NULL`, `ingredient_id → neue Zutat`).
   **Keine Verknüpfung geht verloren** — nur der Typ wechselt Rezept → Zutat.
3. **Altes Rezept archivieren** (nicht löschen) — `recipe_status = 'archived'`,
   Marker `production_notes = 'KONVERTIERT-ZU-ZUTAT: <code> | …'`. → jederzeit zurückrollbar.

Die Migration ist **idempotent** (bereits konvertierte/archivierte Datensätze werden übersprungen)
und löscht nichts.

## 4. Geänderte/neue Dateien

| Datei | Art | Zweck |
|---|---|---|
| `supabase/migrations/20260627000001_reclassify_pdf_recipe_ingredients.sql` | **neu** | Reversible Konvertierung (anlegen → umhängen → archivieren) |
| `supabase/manual/20260627000001_report_reclassify_candidates.sql` | **neu** | Trockenlauf-Report (nur SELECT) — vor der Migration ausführen |
| `supabase/manual/20260627000002_drop_converted_recipe_stubs.sql` | **neu** | Folge-Schritt: archivierte Stubs hart löschen — **manuell nach Prüfung** |
| `services/recipes.service.ts` | geändert | `getAll` blendet `recipe_status='archived'` standardmäßig aus (`includeArchived`-Option) |
| `hooks/use-recipes.ts` | geändert | `useRecipes`-Optionen um `includeArchived` erweitert |

Folge der Service-Änderung: konvertierte (archivierte) Stubs verschwinden aus dem
Rezept-Katalog und allen Rezept-Pickern; in `position_components` erscheinen sie als Zutat.

## 5. Ausführungs-/Roll-out-Reihenfolge (Live-DB)

1. **Report** `supabase/manual/20260627000001_report_reclassify_candidates.sql` im
   Supabase SQL-Editor ausführen → Liste „WIRD ZUTAT" / „BLEIBT REZEPT" prüfen.
2. **Konvertierungs-Migration** `20260627000001_…` über die normale Migrationskette/Deploy
   einspielen (additiv, reversibel).
3. In der App prüfen: betroffene Positionen zeigen die Bestandteile jetzt als **Zutat**.
4. Erst danach — und mit DB-Backup — **manuell** `…000002_drop_converted_recipe_stubs.sql`
   ausführen (Vorschau-SELECT, dann DELETE). Löscht nur nirgends mehr referenzierte Stubs.

## 6. Qualitätssicherung

- `npm run type-check` ✓
- `npm run lint` ✓
- `npm test` ✓ (75/75)
- `npm run build` ✓ (mit gesetzten `NEXT_PUBLIC_SUPABASE_*`; ohne Env schlägt der Prerender
  von `/operations/data-quality` mit „supabaseUrl is required" fehl — rein umgebungsbedingt,
  unabhängig von dieser Änderung).

## 7. Offene Punkte / nächste Blöcke

Dieser Block ist Teil 1 von 11. Noch offen: Teil 2–4 (Komponenteneditor-Audit, Excel-
Schnellbearbeitung, Keyboard-Workflow), Teil 5 (Batch-Filter), Teil 6 (Komponentenlogik),
Teil 7/8 (Importreihenfolge, Lieferantenartikel-Matching Metro/Chefs Culinar), Teil 9
(UI-/Design-System-Audit), Teil 10 (Performance/Virtualisierung).
