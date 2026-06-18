# OSD Catering — Positions-Katalog (geteilte Positionen) — Spec

Status: **Entwurf** · Entscheidung: **echt geteilt** (Single Source of Truth) ·
Vorgehen: Spec → phasenweise. Baut additiv auf V4.5 + Komponenten-Modell auf.

---

## 1. Motivation / Lücke

Heute **gehört eine Position fest zu einem Menü** (`menu_items.menu_id`,
ON DELETE CASCADE). Folgen:
- Positionen sind **nicht wiederverwendbar** — „Blechkuchen" existiert je Menü als
  eigene Zeile (sogar mehrfach).
- Es gibt **keine zentrale Positions-Liste** zum Bearbeiten.
- Beim Anlegen/Bearbeiten eines Menüs lässt sich **keine vorhandene Position
  auswählen** — alles wird neu getippt.

Gewünscht: Positionen als **eigener Katalog**, zentral pflegbar, und Menüs
**setzen sich aus vorhandenen Positionen zusammen** (Auswahl per Dropdown/Picker).
**Einmal ändern → wirkt in allen Menüs**, die die Position nutzen.

## 2. Zielmodell

Eine zusätzliche Ebene; Menü ↔ Position wird **n-zu-m**:

```
Menü ──(menu_positions, sortiert, Preis-Override)──▶ Position ──(position_components)──▶ Rezept / Zutat ──▶ Zutaten
        viele-zu-viele                                (Katalog, geteilt)  (= bisher menu_item_components)
```

## 3. Schema

```
positions(
  id            uuid pk,
  position_code text unique,        -- stabiler Code für Import/Matching (POS-xxxx)
  name          text not null,
  description   text,
  dietary       text,
  allergens     text[] not null default '{}',
  default_price numeric(10,2),      -- Standardpreis; je Menü überschreibbar
  notes         text,
  created_at, updated_at
)

menu_positions(
  id            uuid pk,
  menu_id       uuid -> menus(id)      on delete cascade,
  position_id   uuid -> positions(id)  on delete restrict,   -- Position nicht löschbar, solange genutzt
  sort_order    int  not null default 0,
  price_override numeric(10,2),        -- optionaler Menü-spezifischer Preis
  unique(menu_id, position_id)
)

position_components(            -- = bisheriges menu_item_components, auf positions gezeigt
  id, position_id -> positions(id) on delete cascade,
  recipe_id | ingredient_id, quantity, unit_id, sort_order
  CHECK: genau eines von recipe_id / ingredient_id
)
```

RLS-Policies analog der operativen Tabellen (anon/authenticated FOR ALL).

## 4. Daten-Migration (bestehende 81 menu_items)

1. **Position je menu_item anlegen** (Name/Beschreibung/Ernährung/Allergene/Preis
   übernehmen), `position_code` generieren (POS-0001…).
2. **`menu_positions`** befüllen (menu_id + neue position_id + sort_order; price_override
   = menu_items.item_price falls vorhanden).
3. **Komponenten umhängen:** `menu_item_components` → `position_components`
   (menu_item_id → die neue position_id). Wo eine Position noch keine Komponenten
   hat, aber `menu_items.recipe_id` gesetzt ist → eine Rezept-Komponente (1 Portion)
   anlegen (wie der frühere Backfill).
4. **Dubletten zusammenführen:** **konservativ**. Auto-Merge nur bei **exakt
   gleichem Namen UND gleicher Komponentenmenge**; alle anderen bleiben getrennt
   und werden in der Positions-Liste zum **manuellen Zusammenführen** vorgeschlagen
   (Merge-Werkzeug). So entstehen keine falschen Verschmelzungen.
5. **`menu_items` / `menu_item_components` bleiben vorerst** als Legacy erhalten
   (Fallback), bis die Umstellung komplett ist (Phase „Cutover").

## 5. Engine

`getMenusForCalc` / `computeBatchOutputs` lesen künftig:
`menu → menu_positions → position → position_components`. **Fallback**: hat ein
Menü (noch) keine `menu_positions`, gilt der bisherige Pfad
(`menu_items` + `menu_item_components`). Die zweistufige Logik (Vorproduktion +
Einkauf) bleibt unverändert — nur die Quelle der „Positionen" ändert sich.
`price_override ?? default_price` für Anzeige/Kalkulation.

## 6. UI

- **Neu: Stammdaten → Positionen** — Liste + Detail/Neu/Bearbeiten (wie Zutaten/
  Einheiten): Name, Ernährung, Allergene, Preis, **Komponenten-Editor**
  (der bestehende Dialog, auf `position_components` gezeigt). Zeigt „verwendet in
  N Menüs". Löschen nur, wenn nicht verwendet; sonst „Zusammenführen".
- **Menü-Detail (Umbau):** statt Positionen tippen →
  - **Positions-Picker** (Such-Dropdown) „Vorhandene Position hinzufügen",
  - **„Neue Position anlegen"** (legt im Katalog an + hängt ans Menü),
  - Liste der zugeordneten Positionen mit **Sortierung** + Preis-Override + Entfernen
    (entfernt nur die Zuordnung, nicht die Position).
- Der Komponenten-Editor wandert von der Menü-Position in die **Katalog-Position**
  (eine Pflegestelle, wirkt überall).

## 7. Import / Matching

- Neues Blatt **`positions`** (position_code, name, dietary, allergens, default_price)
  und **`menu_positions`** (menu_code, position_code, sort_order, price_override).
- `position_components` analog menu_item_components, auf position_code bezogen.
- Bestehender `menu_items`-Import bleibt für Übergang; später ablösen.
- Matching-Center (V5) ordnet Fremdtexte → position_code.

## 8. Phasen

1. **Schema + Migration** — `positions`, `menu_positions`, `position_components`;
   Daten aus `menu_items`/`menu_item_components` übernehmen (konservativer Merge).
2. **Engine** — Lesepfad auf menu_positions umstellen (Legacy-Fallback), Tests.
3. **UI** — Positionen-Katalog (Liste/CRUD + Komponenten); Menü-Editor mit
   Positions-Picker, Sortierung, Preis-Override, „Neue Position anlegen".
4. **Daten** — Dubletten zusammenführen, Menüs auf Katalog-Positionen umstellen.
5. **Cutover** — `menu_items` / `menu_item_components` entfernen, sobald nichts mehr
   darauf zeigt.

## 9. Offene Punkte / Entscheidungen

- **Dubletten-Merge-Strategie:** Auto-Merge nur bei Name+Komponenten identisch
  (Vorschlag). Rest manuell. OK so?
- **Preis:** `default_price` an der Position + `price_override` je Menü — reicht das,
  oder Preis ausschließlich am Menü?
- **Löschschutz:** Position mit `ON DELETE RESTRICT` in `menu_positions` →
  nicht löschbar, solange in einem Menü. (Empfohlen.)
- **Allergene/Ernährung:** an der Position zentral (geteilt). Menü-spezifische
  Abweichung vorerst nicht vorgesehen.
- **menu_items entfernen:** erst in Phase 5 (Cutover), nicht früher.
```
