# Audit & Umsetzung — Teil 3–6: Produktionsmodus für Positionen

Stand: 2026-06-27 · Block 2 des Workflow-Audits

---

## Befund (Audit Teil 2)

Der alte Komponenteneditor war ein **Modal pro Position** mit verschachteltem
Zweit-Dialog (Rezept-Picker). Pro Position: Seite → Button → Modal → Picker-Modal →
Menge → Einheit → Hinzufügen → schließen. Für hunderte Positionen zu langsam,
keine Tastaturbedienung, kein Statusüberblick, keine Mehrfachbearbeitung.

## Umsetzung

### Teil 5 — Status & Batch-Filter
- Neue Spalte **Status** je Position: `Leer` (rot) wenn 0 Komponenten, sonst
  `Vollständig` (grün) + Mini-Anzeige `📖 n` Rezepte / `🥕 n` Zutaten.
- **Filterleiste** mit Live-Zählern: Alle · Ohne Komponenten · Ohne Rezept ·
  Ohne Zutaten · Nur 1 Komponente · PDF-Import. Damit lassen sich unvollständige
  Gruppen gezielt abarbeiten.
- Service `positions.getAll` liefert jetzt `recipeCount` / `ingredientCount`
  (statt nur Gesamt-Count) — Status ohne Detail-Load.

### Teil 3 — Inline-Bearbeitung (kein Dialog mehr)
- Zeile **aufklappen** (Klick oder Enter) → Komponenteneditor **direkt in der Zeile**.
- Pro Komponente inline: Menge (onBlur), Einheit (Select), Löschen.
- Add-Zeile inline: Zutat/Rezept umschalten, wählen, Menge, Einheit, Hinzufügen —
  ohne die Seite/Zeile zu verlassen. Nach dem Hinzufügen bleibt der Fokus für
  schnelles Weitererfassen.
- Der alte `position-components-dialog.tsx` wurde entfernt (ersetzt).

### Teil 4 — Keyboard-Workflow
- `↑`/`↓` (oder `j`/`k`): Position wählen
- `Enter`: Zeile auf-/zuklappen
- `Strg+Enter`: in der Add-Zeile speichern **und zur nächsten Position springen**
  (`Strg+↑`/`Strg+↓`: zur vorigen/nächsten Position, jeweils geöffnet)
- `Esc`: Editor schließen
- In Eingabefeldern bleibt die normale Tastatur (Tab/Pfeile) aktiv; Navigation
  greift nur außerhalb der Felder.

### Teil 6 — Komponentenlogik (verifiziert)
Das Datenmodell `position_components` (CHECK: genau ein Ziel je Zeile) unterstützt
bereits **beliebig viele Rezept- UND Zutat-Komponenten** je Position (z. B. Caesar
Salad: Rezepte Dressing/Croutons + Zutaten Parmesan/Romana/Zitrone). Keine Migration
nötig; der Inline-Editor macht das jetzt direkt nutzbar und sichtbar.

## Geänderte/neue Dateien
| Datei | Art |
|---|---|
| `app/(admin)/master-data/positions/page.tsx` | Produktionsmodus: Filter, Status, Inline-Expand, Keyboard |
| `components/master-data/positions/position-inline-editor.tsx` | **neu** — Inline-Komponenteneditor |
| `services/positions.service.ts` | `getAll` liefert recipeCount/ingredientCount |
| `components/master-data/positions/position-components-dialog.tsx` | **entfernt** (ersetzt) |

## Qualitätssicherung
`type-check` ✓ · `lint` ✓ · `test` ✓ (75/75) · `build` ✓

## Hinweis
„Auto-Match" als Filter (aus der Wunschliste) ist derzeit **kein** gespeichertes
Positionsattribut und wurde daher bewusst nicht als Pseudo-Filter erfunden. Sobald
Importe eine Match-Herkunft am Datensatz markieren, lässt sich der Filter ergänzen.
