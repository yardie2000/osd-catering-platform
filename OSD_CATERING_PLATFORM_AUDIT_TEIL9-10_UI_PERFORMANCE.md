# Audit & Umsetzung — Teil 9+10: Design-Sprache & Performance

Stand: 2026-06-28 · Block 4 des Workflow-Audits

---

## Teil 9 — UI-Audit & einheitliche Design-Sprache

### Befund (Inkonsistenzen)
- **Padding** uneinheitlich: `p-8` (Positionen) vs. `p-4 sm:p-6 lg:p-8` (Zutaten/Lieferanten).
- **Lade-/Leer-/Fehlerzustände**: `components/ui/state.tsx` existierte (`LoadingState`,
  `EmptyState`, `ErrorState`), wurde aber nur teils genutzt — die meisten Listen
  inlineten „Laden…" / „Keine … gefunden." als Tabellentext.

### Umsetzung
- Neuer geteilter Container **`components/layout/page-content.tsx`** (`PageContent`)
  mit einheitlichem responsivem Padding und Abstand. Auf Positionen- und Zutaten-Seite
  angewandt (weitere Seiten folgen demselben Muster).
- Lade-/Leerzustände auf Positionen- und Zutaten-Seite auf die geteilten
  `LoadingState` / `EmptyState` umgestellt → konsistente Optik (Spinner/Inbox-Icon,
  gleiche Typo) statt ad-hoc-Tabellentext.

Damit ist die Design-Sprache für die Listen vereinheitlicht: gleicher Seitenrahmen
(`PageHeader` + `PageContent`), gleiches Tabellen-in-Card-Muster, gleiche Zustände,
gleiche Badge-Varianten (`success`/`warning`/`error`/`secondary`/`outline`).

## Teil 10 — Performance

### Virtualisierung (dependency-frei)
- Neuer Hook **`hooks/use-virtual-rows.ts`** mit reiner, unit-getesteter
  Fenster-Mathematik (`computeWindow`). Rendert nur die im Viewport sichtbaren Zeilen
  ± Overscan; obere/untere Platzhalter halten Scrollhöhe und Spaltenbreiten korrekt.
- Auf der **Zutaten-Liste** angewandt (Ziel bis ~2500 Zeilen): scrollbarer Container
  mit fester Zeilenhöhe (56px) und **stickyem Tabellenkopf**. Aktiviert sich erst ab
  > 80 Zeilen; kürzere Listen rendern unverändert vollständig.
- Tests: `tests/virtualRows.test.ts` (6 Fälle: Anfang/Mitte/Ende, Gesamthöhe,
  leere Liste, negativer Scroll).

### Weniger Re-Renders
- **Memoisierte Zeilen-Komponenten** (`React.memo`): `IngredientRow` (Zutaten) und
  `PositionRow` (Positionen). Zeilen rendern nur neu, wenn sich ihre Props ändern.
- **Stabile Callbacks** (`useCallback`) für Auswahl, Auf-/Zuklappen, Bearbeiten,
  Löschen — damit greift die Memoisierung. Konkreter Effekt: Tastatur-Navigation
  (↑/↓) auf der Positionen-Seite rendert nur die zwei betroffenen Zeilen neu statt
  aller Zeilen.

### Caching / Query-Keys
- Listen-Queries nutzen stabile Keys und `staleTime` (Positionen/Zutaten 5 min);
  Mutationen invalidieren gezielt die betroffenen Keys (bestehend, geprüft).

## Geänderte/neue Dateien
| Datei | Art |
|---|---|
| `hooks/use-virtual-rows.ts` | **neu** — Virtualisierungs-Hook + reine `computeWindow` |
| `tests/virtualRows.test.ts` | **neu** — 6 Unit-Tests |
| `components/layout/page-content.tsx` | **neu** — einheitliches Seiten-Padding |
| `app/(admin)/master-data/ingredients/page.tsx` | Virtualisierung, `IngredientRow`-Memo, States, PageContent |
| `app/(admin)/master-data/positions/page.tsx` | `PositionRow`-Memo, stabile Callbacks, States, PageContent |
| `package.json` | Test-Skript um virtualRows erweitert |

## Qualitätssicherung
`type-check` ✓ · `lint` ✓ · `test` ✓ (96/96) · `build` ✓

## Hinweis zur visuellen Prüfung
Die Virtualisierung der Zutaten-Liste (fixe Zeilenhöhe 56px, Sticky-Header, Box-Scroll
bei > 80 Zeilen) sollte einmal im Browser gegengeprüft werden — die Zeilen sind durch
die auf 3 Allergene begrenzte Anzeige einzeilig und damit höhenkonstant; bei künftigen
mehrzeiligen Zellen wäre die Zeilenhöhe anzupassen.
