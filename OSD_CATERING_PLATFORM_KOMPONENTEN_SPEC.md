# OSD Catering — Komponenten-/Stücklisten-Modell (Spec)

Status: **Entwurf** · Ziel: Menü-Positionen aus mehreren Bestandteilen + zweistufige
(Vor-)Produktion. Baut additiv auf V4.5 auf, wirft nichts Bestehendes weg.

---

## 1. Motivation

Eine reale Teller-Position besteht oft aus **mehreren Bestandteilen** — teils
**zugekauft** (fertig vom Lieferanten), teils **selbst vorproduziert** (Saucen,
Pürees, Beilagen):

- *Poulardenbrust (zugekauft) + Nussbutter-Kartoffel-Püree*
- *Gerösteter Blumenkohl (roh) + Haselnuss-Sauce + Gremolata*
- *Tarte (zugekauft) + Karamellsauce*
- *Austern (3 Stk) + Crémant (0,1 l)*

Komponenten wie Saucen werden **chargenweise für eine ganze Woche vorproduziert**;
eine Position verbraucht davon z. B. **1 Portion**. Die Produktionsplanung muss
daher den Komponentenbedarf **über die Woche aufsummieren** („produziere X Liter
Haselnuss-Sauce") und parallel den Roh-Einkauf ableiten.

## 2. Lücke im aktuellen Modell (V4.5)

| Anforderung | Heute | Lücke |
|---|---|---|
| Position = mehrere Bestandteile | `menu_items` → **1** `recipe_id` | nur 1 Bestandteil |
| Rezept aus (Sub-)Rezepten | `recipe_ingredients` = nur Roh-Zutaten | keine Rezept-Komposition |
| Vorproduktion je Komponente | Produktion 1-stufig (Menü→Rezept→Zutat) | keine Komponenten-Aggregation |

## 3. Datenmodell

Neue Tabelle **`menu_item_components`** — eine Position bekommt N Bestandteile:

```
menu_item_components(
  id            uuid pk
  menu_item_id  uuid  -> menu_items(id)  on delete cascade
  recipe_id     uuid  -> recipes(id)      NULL  -- Komponente IST ein vorprod. Rezept
  ingredient_id uuid  -> ingredients(id)  NULL  -- ODER eine zugekaufte/rohe Zutat
  quantity      numeric(12,4) > 0               -- Menge pro Portion der Position
  unit_id       uuid  -> units(id)         NULL -- bei Rezept-Komponente NULL = Portionen
  sort_order    int
)
CHECK: genau eines von recipe_id / ingredient_id gesetzt
```

- **Zugekauft/roh** → `ingredient_id`-Komponente (Poularde 1 Stk, Blumenkohl 150 g).
- **Vorproduziert** → `recipe_id`-Komponente (Haselnuss-Sauce 1 Portion) — verweist
  auf ein **eigenes, wiederverwendbares** Rezept (einmal pflegen, überall nutzen).
- `menu_items.recipe_id` wird **Legacy** (bleibt erhalten für Übergang/Rückwärts­kompatibilität); **Quelle der Wahrheit** sind ab Phase 2 die Komponenten.

Ebenen: **Position → Komponente(Rezept) → Roh-Zutaten** (2 Ebenen). Mehrebenen-
Stücklisten (Sub-Rezept eines Sub-Rezepts) sind **vorerst nicht** vorgesehen
(später optional via `recipe_components`).

## 4. Bedarfsrechnung (zweistufig)

Pro Produktionslauf (= z. B. eine Woche: alle Menüs + Personenzahl):

```
für jede Position (menu_item) mit pax:
  für jede Komponente:
    menge = component.quantity * pax
    wenn ingredient-Komponente:
        -> EINKAUF[ingredient] += menge (Einheit der Komponente)
    wenn recipe-Komponente (Portionen):
        -> VORPRODUKTION[recipe] += menge           (Portionen, wochenweit summiert)
        faktor = menge / recipe.base_portions
        für jede recipe_ingredient:
            -> EINKAUF[ingredient] += ri.quantity * faktor
```

- **Produktionsausgabe** bekommt zwei Abschnitte:
  - **Vorproduktion (Komponenten)** — was die Küche vorab chargenweise herstellt
    (je Rezept Summe der Portionen, hochgerechnet auf Ausbeute/Verlust wie heute).
  - **Endmontage** — die Teller-Positionen je Menü (Übersicht/Packliste).
- **Einkaufsausgabe** — alle Roh-Zutaten (aus Sub-Rezepten) **plus** zugekaufte
  Zutaten-Komponenten, aggregiert nach Zutat/Lieferant (wie heute, nur gespeist
  aus der Komponenten-Explosion).
- Verlust-/Ausbeute-Logik (`production_loss_pct`, `yield_pct`, `base_portions`)
  bleibt wie in V4.5; gilt nun je vorproduziertem Komponenten-Rezept.

## 5. UI

- **Menü-Detail / Position:** Komponenten-Editor — Zeilen hinzufügen, je Zeile
  „Rezept **oder** Zutat" wählen, Menge + Einheit. (Ersetzt das Einzel-Rezept-Picker.)
- **Produktionsausgabe:** neuer Block „Vorproduktion (Komponenten)" vor der Endmontage.
- Rezepte erhalten optional eine Kennzeichnung „vorproduzierbare Komponente" (Filter/Anzeige).

## 6. Import / Matching

- Re-Import muss Komponenten setzen können: neues Excel-Blatt
  `menu_item_components` (menu_code, position_name, recipe_code **oder**
  ingredient_code, quantity, unit) — analog `menu_items`.
- Bestehender `menu_items`-Import bleibt; einzelnes `recipe_code` wird beim Import
  weiterhin (zusätzlich) als 1-Portion-Komponente gespiegelt, bis komplett umgestellt.
- Matching-Center (V5) ordnet Fremdtexte → recipe_code/ingredient_code.

## 7. Phasen

1. **Schema** — `menu_item_components` + Backfill der bestehenden Einzel-Links
   (je 1 Portion). *(diese Migration)*
2. **Engine** — `computeBatchOutputs` um Komponenten-Explosion + Vorproduktions-
   Aggregation erweitern; Tests (Vorproduktion, Roh-Einkauf, gemischte Position).
3. **UI** — Komponenten-Editor je Position; Produktionsausgabe „Vorproduktion".
4. **Import** — `menu_item_components`-Blatt; Daten je Position füllen.

## 8. Offene Punkte / Entscheidungen

- **Einheit Rezept-Komponente:** standardmäßig „Portionen". Soll auch direkte
  Mengen (z. B. „0,1 l Sauce") erlaubt sein? → vorerst Portionen, später optional.
- **Mehrebenen-Stücklisten** (Sub-Rezept im Sub-Rezept): vorerst nein.
- **`menu_items.recipe_id`** endgültig entfernen: erst nach vollständiger Umstellung
  (Phase 4), nicht jetzt.
- **Vorproduktions-Haltbarkeit/Charge**: aktuell nur Mengen; Chargen-/MHD-Tracking
  ist ein späteres Thema.
