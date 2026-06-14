-- ============================================================
-- OSD Catering Platform V4.5 — Datenqualitäts-Audit der Rezeptbasis
-- Migration: 20260613000003_recipe_base_audit
--
-- Snapshots which recipes have a complete production base
-- (base_portions + yield_quantity + yield_unit_id). Uses the REAL snake_case
-- columns, not legacy camelCase. Runs AFTER 20260613000002 (base_portions).
--
-- Idempotent: the audit table is (re)created if missing and fully refreshed.
-- ============================================================

create table if not exists public.recipe_base_audit (
  recipe_id           uuid primary key references public.recipes(id) on delete cascade,
  recipe_name         text not null,
  recipe_code         text null,
  base_portions       numeric(12,3) null,
  yield_quantity      numeric(12,4) null,
  yield_unit_id       uuid null references public.units(id) on delete set null,
  yield_pct           numeric(5,2) null,
  production_loss_pct numeric(5,2) null,
  has_recipe_base     boolean not null,
  audit_note          text not null,
  audited_at          timestamptz not null default now()
);

delete from public.recipe_base_audit;

insert into public.recipe_base_audit (
  recipe_id,
  recipe_name,
  recipe_code,
  base_portions,
  yield_quantity,
  yield_unit_id,
  yield_pct,
  production_loss_pct,
  has_recipe_base,
  audit_note
)
select
  r.id,
  r.name,
  r.recipe_code,
  r.base_portions,
  r.yield_quantity,
  r.yield_unit_id,
  r.yield_pct,
  r.production_loss_pct,
  (r.base_portions is not null and r.base_portions > 0
    and r.yield_quantity is not null and r.yield_quantity > 0
    and r.yield_unit_id is not null) as has_recipe_base,
  case
    when r.base_portions is null and r.yield_quantity is null then 'Basisportionen und Ertrag fehlen'
    when r.base_portions is null then 'Basisportionen fehlen'
    when r.base_portions <= 0 then 'Basisportionen sind nicht positiv'
    when r.yield_quantity is null then 'Ertrag (yield_quantity) fehlt'
    when r.yield_quantity <= 0 then 'Ertrag ist nicht positiv'
    when r.yield_unit_id is null then 'Ertragseinheit fehlt'
    else 'OK'
  end as audit_note
from public.recipes r;

comment on table public.recipe_base_audit is
  'V4.5: Datenqualitäts-Snapshot — welche Rezepte eine vollständige Produktionsbasis besitzen.';

notify pgrst, 'reload schema';
