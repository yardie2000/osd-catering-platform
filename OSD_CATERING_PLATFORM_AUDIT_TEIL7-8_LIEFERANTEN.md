# Audit & Umsetzung — Teil 7+8: Importreihenfolge & Lieferantenartikel-Matching

Stand: 2026-06-27 · Block 3 des Workflow-Audits

---

## Teil 7 — Importreihenfolge (verifiziert)

Die geforderte Reihenfolge **PDF → Positionen → Rezepte → Zutaten → Lieferantenartikel
→ Einkauf → Produktion** ist im Datenmodell bereits verankert und wird durch Teil 8
korrekt fortgesetzt:

- `position_components` zeigen auf `recipes`/`ingredients` (Teil 1/3–6).
- `supplier_articles` (real bestellbare EK-Artikel) hängen **unter** den Zutaten,
  verbunden über `ingredient_supplier_articles` (n:m). Lieferantenartikel sind damit
  die letzte Ebene vor Einkauf — nie umgekehrt.
- Die neue Matching-Engine legt fehlende **Zutaten** an, bevor ein **Lieferantenartikel**
  zugeordnet wird (Zutat existiert immer zuerst). Damit bleibt die Reihenfolge gewahrt.

## Teil 8 — Lieferantenartikel automatisch Zutaten zuordnen

### Befund
Das Datenmodell (`supplier_articles`, `ingredient_supplier_articles` mit
`match_type`/`match_score`/`needs_review`/`is_preferred`) und die Zuordnungs-UART
(„Lieferanten-Zuordnung") existierten bereits — aber **niemand erzeugte die
Kandidaten-Mappings**. Man konnte nur vorhandene Kandidaten auswählen.

### Umsetzung — Matching-Engine
Neu: `lib/supplier-matching/matchEngine.ts` (rein, unit-getestet):
- `scoreNames` — gerichteter Token-Overlap (Zutaten-Tokens im Artikelnamen) +
  Wortgrenzen-Treffer. **Mengen-/Gebinde-Rauschen (Tokens mit Ziffer) wird verworfen**,
  damit geteilte Mengenangaben ("125 g …") keine Falschtreffer erzeugen.
- `classifyArticle` → Entscheidung nach Teil-8-Regeln:
  - **genau ein klarer Treffer** → verknüpfen (kein Review)
  - **mehrere plausible Treffer** → besten verknüpfen, als **Review** markieren (Assistent)
  - **kein Treffer** → **neue Zutat anlegen** + verknüpfen
- `cleanIngredientName` — macht aus rohen Artikelnamen brauchbare Zutatennamen
  ("125 g BROMBEEREN ES" → "Brombeeren").

Service `supplierArticlesService.autoAssignUnmapped()` wendet das auf alle offenen,
aktiven **Lebensmittel**-Artikel an. Invariante: **ein Artikel = genau ein Mapping**
(bereits zugeordnete Artikel werden übersprungen → idempotent). Nicht-Lebensmittel
werden nicht zu Zutaten.

UI: Button **„Auto-Zuordnung"** auf der Lieferanten-Zuordnungs-Seite; Ergebnis als Toast
(verknüpft / zur Prüfung / neue Zutaten). Mehrdeutige landen mit `needs_review` im
bestehenden Kandidaten-Picker (⚠) zur Bestätigung.

### Bewusst NICHT automatisch auf der Live-DB ausgeführt
Ein Trockenlauf gegen die Live-DB (586 Artikel, 456 bereits zugeordnet, **291 offen**)
ergab: 47 klare Verknüpfungen, 67 Review, **177 neue Zutaten**. Da das den Zutaten-
Katalog (161) mehr als verdoppeln und teils unsaubere Namen erzeugen würde, ist der
Massen-Anlauf eine **fachliche Entscheidung des Betreibers** — nicht etwas, das blind
gegen die Produktivdaten laufen sollte. Der Button steht bereit; die Massenanlage
erfolgt bewusst per Klick (oder nach gezielter Namensbereinigung in einem Folgeschritt).

## Geänderte/neue Dateien
| Datei | Art |
|---|---|
| `lib/supplier-matching/matchEngine.ts` | **neu** — Matching-Engine + Namensbereinigung |
| `tests/supplierMatch.test.ts` | **neu** — 15 Unit-Tests |
| `services/supplier-articles.service.ts` | `autoAssignUnmapped()` |
| `hooks/use-supplier-articles.ts` | `useAutoAssignSupplierArticles()` |
| `app/(admin)/master-data/ingredients/suppliers/page.tsx` | Button „Auto-Zuordnung" |
| `package.json` | Test-Skript um supplierMatch erweitert |

## Qualitätssicherung
`type-check` ✓ · `lint` ✓ · `test` ✓ (90/90) · `build` ✓
