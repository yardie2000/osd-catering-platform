-- ============================================================
-- OSD Catering Platform V5 — Lieferantenartikel (EK) Datenmodell
-- Migration: 20260625000001_supplier_articles_ek
--
-- Zweck
--   Reale, bestellbare Lieferantenartikel (Einkauf / EK) aus den
--   METRO- und CHEFS-CULINAR-Rechnungen sauber von der fachlichen,
--   lieferantenneutralen `ingredients`-Tabelle trennen und über eine
--   n:m-Mapping-Tabelle verbinden.
--
-- Grundprinzipien
--   • Die Zutat (`ingredients`) bleibt lieferantenneutral und wird von
--     dieser Migration NICHT verändert (kein Überschreiben von Namen).
--   • EK lebt ausschließlich in `supplier_articles` /
--     `ingredient_supplier_articles` / `supplier_article_price_history`.
--   • VK (Verkaufspreise) gehören NIE in diese Tabellen — sie bleiben in
--     Menüs / Menüpositionen / Rezeptkalkulation.
--   • Eine Zutat kann mehrere Lieferantenartikel haben; pro Zutat darf
--     genau EIN Artikel `is_preferred = true` sein (partial unique index).
--
-- Bestand (bewusst NICHT angefasst)
--   • `public.suppliers`        — Stub aus V2 (supplier_code/name/active);
--                                 hier nur um `customer_number` erweitert.
--   • `public.supplier_products`— flache ingredient↔supplier Tabelle aus
--                                 V3; bleibt unverändert bestehen. Das neue
--                                 normalisierte Modell ist die EK-Quelle der
--                                 Wahrheit; `supplier_products` kann später
--                                 migriert/deprecated werden (separater PR).
--
-- Idempotent: IF NOT EXISTS / DROP-IF-EXISTS überall.
--
-- ⚠️ SICHERHEIT: Wie bei den bestehenden anon-Policies (Migrationen
--   …0006 / persistence_policies) läuft die öffentliche Bereitstellung
--   ohne Login als Rolle `anon`. Die anon-Schreibpolicies unten erlauben
--   jedem, der die Projekt-URL erreicht, EK-Daten zu schreiben. Für eine
--   echte öffentliche Bereitstellung: echte Auth einführen und Schreibrechte
--   auf `authenticated` beschränken.
-- ============================================================

-- ── 0. suppliers: Kundennummer ergänzen ──────────────────────
-- Bestehende Spalten (V2): supplier_code, name, contact_name, email,
-- phone, notes, active, created_at, updated_at. Wir ergänzen nur die
-- Lieferanten-Kundennummer (z. B. METRO "32").
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS customer_number TEXT;

COMMENT ON COLUMN public.suppliers.customer_number IS
  'Kundennummer des Lieferanten für unseren Betrieb (z. B. METRO 32).';

-- ── 1. supplier_articles ─────────────────────────────────────
-- Ein Datensatz = ein real bestellbarer Artikel eines Lieferanten.
-- Enthält den AKTUELLEN EK (jüngste Rechnung). Historie -> price_history.
CREATE TABLE IF NOT EXISTS public.supplier_articles (
  id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id             UUID         NOT NULL REFERENCES public.suppliers (id) ON DELETE RESTRICT,

  -- Artikel-Identität (real, unverändert nachvollziehbar)
  supplier_article_number TEXT,
  ean_gtin                TEXT,
  raw_article_name        TEXT,
  clean_article_name_de   TEXT,
  ingredient_name_de      TEXT,          -- vom Lieferanten abgeleiteter Zutatenname (NICHT die Master-Zutat)
  category_de             TEXT,
  product_type_de         TEXT,

  -- Klassifizierung
  is_food                 BOOLEAN      NOT NULL DEFAULT true,
  is_frozen               BOOLEAN      NOT NULL DEFAULT false,
  is_fresh                BOOLEAN      NOT NULL DEFAULT false,
  is_bio                  BOOLEAN      NOT NULL DEFAULT false,
  origin_country          TEXT,
  tax_rate_percent        NUMERIC(5,2),

  -- Gebinde / Inhalt / Basismenge
  packaging_unit          TEXT,
  packaging_quantity      NUMERIC(14,4),
  content_quantity        NUMERIC(14,4),
  content_unit            TEXT,
  base_unit               TEXT,
  base_quantity_total     NUMERIC(16,4),

  -- EK (Einkauf, netto) — NUR EK, niemals VK
  ek_single_price_net     NUMERIC(14,4) CHECK (ek_single_price_net     >= 0),
  ek_price_unit           TEXT,
  ek_total_price_net      NUMERIC(14,4) CHECK (ek_total_price_net      >= 0),
  ek_price_per_base_unit  NUMERIC(16,6) CHECK (ek_price_per_base_unit  >= 0),
  currency                TEXT         NOT NULL DEFAULT 'EUR',

  -- Belegspur (jüngste Rechnung)
  last_invoice_number     TEXT,
  last_invoice_date       DATE,
  last_source_file        TEXT,

  -- Dedup-/Matching-Schlüssel aus der Pipeline
  match_key               TEXT,          -- = "<lieferant>:<artikelnummer>"
  duplicate_group_key     TEXT,          -- Zutaten-Ebene ("ing:<slug>")

  is_active               BOOLEAN      NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Ein Artikel je Lieferant + Artikelnummer
  CONSTRAINT supplier_articles_supplier_artno_key
    UNIQUE (supplier_id, supplier_article_number)
);

COMMENT ON TABLE public.supplier_articles IS
  'Reale, bestellbare Lieferantenartikel (EK). Lieferantengebunden; verknüpft mit Zutaten über ingredient_supplier_articles. Enthält den aktuellen EK; ältere Preise in supplier_article_price_history.';

-- Idempotenter Upsert weiterer Rechnungen über match_key
CREATE UNIQUE INDEX IF NOT EXISTS supplier_articles_match_key_uidx
  ON public.supplier_articles (match_key)
  WHERE match_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_articles_supplier   ON public.supplier_articles (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_articles_ean        ON public.supplier_articles (ean_gtin);
CREATE INDEX IF NOT EXISTS idx_supplier_articles_dupgroup   ON public.supplier_articles (duplicate_group_key);
CREATE INDEX IF NOT EXISTS idx_supplier_articles_is_food    ON public.supplier_articles (is_food);
CREATE INDEX IF NOT EXISTS idx_supplier_articles_active     ON public.supplier_articles (is_active);

CREATE TRIGGER supplier_articles_updated_at
  BEFORE UPDATE ON public.supplier_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. supplier_article_price_history ────────────────────────
-- Historische EK-Preise je Artikel (eine Zeile pro Rechnung/Beleg).
CREATE TABLE IF NOT EXISTS public.supplier_article_price_history (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_article_id    UUID         NOT NULL REFERENCES public.supplier_articles (id) ON DELETE CASCADE,
  invoice_number         TEXT,
  invoice_date           DATE,
  source_file            TEXT,
  ek_single_price_net    NUMERIC(14,4) CHECK (ek_single_price_net    >= 0),
  ek_total_price_net     NUMERIC(14,4) CHECK (ek_total_price_net     >= 0),
  ek_price_per_base_unit NUMERIC(16,6) CHECK (ek_price_per_base_unit >= 0),
  currency               TEXT         NOT NULL DEFAULT 'EUR',
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Keine doppelten Belegzeilen je Artikel bei Re-Import
  CONSTRAINT supplier_article_price_history_ukey
    UNIQUE (supplier_article_id, invoice_number, invoice_date)
);

COMMENT ON TABLE public.supplier_article_price_history IS
  'Historische EK-Preise je Lieferantenartikel; speist sich aus älteren Rechnungen, ohne den aktuellen EK in supplier_articles zu überschreiben.';

CREATE INDEX IF NOT EXISTS idx_sa_price_hist_article ON public.supplier_article_price_history (supplier_article_id);
CREATE INDEX IF NOT EXISTS idx_sa_price_hist_date    ON public.supplier_article_price_history (invoice_date);

-- ── 3. ingredient_supplier_articles ──────────────────────────
-- Mapping Zutat <-> Lieferantenartikel (n:m).
CREATE TABLE IF NOT EXISTS public.ingredient_supplier_articles (
  id                                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id                       UUID         NOT NULL REFERENCES public.ingredients (id)        ON DELETE CASCADE,
  supplier_article_id                 UUID         NOT NULL REFERENCES public.supplier_articles (id)  ON DELETE CASCADE,

  match_type                          TEXT         NOT NULL DEFAULT 'manuell'
                                        CHECK (match_type IN
                                          ('exakt','starker_name','synonym','kategorie_einheit','mehrdeutig','manuell')),
  match_score                         INTEGER      NOT NULL DEFAULT 0
                                        CHECK (match_score BETWEEN 0 AND 100),

  is_preferred                        BOOLEAN      NOT NULL DEFAULT false,
  priority                            INTEGER      NOT NULL DEFAULT 100,

  -- Faktor, um die Artikel-Basiseinheit in die Zutaten-Einheit umzurechnen
  conversion_factor_to_ingredient_unit NUMERIC(18,6),
  -- Optionaler manueller EK-Override (sonst gilt der Artikelpreis)
  ek_price_override                   NUMERIC(14,4) CHECK (ek_price_override >= 0),

  notes                               TEXT,
  needs_review                        BOOLEAN      NOT NULL DEFAULT false,
  review_reason                       TEXT,
  created_at                          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at                          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT ing_sup_art_unique UNIQUE (ingredient_id, supplier_article_id)
);

COMMENT ON TABLE public.ingredient_supplier_articles IS
  'Mapping zwischen fachlicher Zutat und realem Lieferantenartikel. Genau ein is_preferred=true pro Zutat (partial unique index). Trägt Matching-Metadaten, Umrechnungsfaktor und optionalen EK-Override.';

-- Genau EIN bevorzugter Artikel pro Zutat
CREATE UNIQUE INDEX IF NOT EXISTS ing_sup_art_one_preferred_uidx
  ON public.ingredient_supplier_articles (ingredient_id)
  WHERE is_preferred;

CREATE INDEX IF NOT EXISTS idx_isa_ingredient ON public.ingredient_supplier_articles (ingredient_id);
CREATE INDEX IF NOT EXISTS idx_isa_article    ON public.ingredient_supplier_articles (supplier_article_id);
CREATE INDEX IF NOT EXISTS idx_isa_review     ON public.ingredient_supplier_articles (needs_review);

CREATE TRIGGER ingredient_supplier_articles_updated_at
  BEFORE UPDATE ON public.ingredient_supplier_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Row Level Security ────────────────────────────────────
ALTER TABLE public.supplier_articles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_article_price_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredient_supplier_articles    ENABLE ROW LEVEL SECURITY;

do $$
declare t text;
begin
  foreach t in array array[
    'supplier_articles','supplier_article_price_history','ingredient_supplier_articles'
  ]
  loop
    -- authenticated: voller Zugriff
    execute format('drop policy if exists %I on public.%I', 'authenticated_all_' || t, t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      'authenticated_all_' || t, t);
    -- anon: voller Zugriff (öffentliche No-Auth-Bereitstellung; s. Sicherheitshinweis oben)
    execute format('drop policy if exists %I on public.%I', 'anon_write_' || t, t);
    execute format(
      'create policy %I on public.%I for all to anon using (true) with check (true)',
      'anon_write_' || t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
