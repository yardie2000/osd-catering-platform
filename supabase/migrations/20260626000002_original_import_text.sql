-- Preserve the original MouseClick CSV source text independently from review assignments.

ALTER TABLE public.imported_event_orders
  ADD COLUMN IF NOT EXISTS original_import_text TEXT NOT NULL DEFAULT '';

UPDATE public.imported_event_orders
SET original_import_text = concat_ws(E'\n',
  'Produkt: ' || product_name,
  'Langbezeichnung: ' || long_description,
  'Menge: ' || total_quantity::text,
  'Einheit: ' || unit,
  'Auftraege: ' || raw_orders,
  'Klassifizierung: ' || category
)
WHERE original_import_text = '';

COMMENT ON COLUMN public.imported_event_orders.original_import_text IS
  'Read-only documentation copy of the imported MouseClick CSV row fields. Review changes must not modify it.';

NOTIFY pgrst, 'reload schema';
