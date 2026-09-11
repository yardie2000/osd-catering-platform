-- Backfill: bevorzugten Lieferantenartikel je Zutat setzen.
--
-- Die Auto-Zuordnung hat Kandidaten angelegt, aber keinen bevorzugten Lieferanten
-- markiert (is_preferred = false). In der Zuordnungs-Übersicht stand deshalb
-- „— keiner —", obwohl ein eindeutiger Treffer existierte.
--
-- Hier wird je Zutat, die noch keinen bevorzugten Lieferanten hat und mindestens
-- einen eindeutigen (needs_review = false) Kandidaten besitzt, der beste Kandidat
-- als bevorzugt gesetzt (höchster match_score, dann ältester Eintrag).
-- Mehrdeutige Fälle (nur needs_review-Kandidaten) bleiben offen und müssen manuell
-- bestätigt werden. DISTINCT ON garantiert genau einen bevorzugten Artikel je Zutat
-- (respektiert den Partial-Unique-Index ing_sup_art_one_preferred_uidx).
-- Idempotent: bereits gesetzte Zutaten werden durch das NOT EXISTS übersprungen.

with best as (
  select distinct on (isa.ingredient_id) isa.id
  from ingredient_supplier_articles isa
  where isa.needs_review = false
    and not exists (
      select 1
      from ingredient_supplier_articles p
      where p.ingredient_id = isa.ingredient_id
        and p.is_preferred
    )
  order by isa.ingredient_id, isa.match_score desc, isa.created_at asc, isa.id
)
update ingredient_supplier_articles t
set is_preferred = true,
    updated_at = now()
from best
where t.id = best.id;
