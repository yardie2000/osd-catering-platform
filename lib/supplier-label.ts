// Lieferantenname auflösen: bevorzugt der echte (eingebettete) Name; Fallback
// aus dem match_key-Präfix (metro:/chefs:), falls der suppliers-Embed (noch)
// leer ist. Geteilt von Liste und EK-Sektion.
export const SUPPLIER_BY_PREFIX: Record<string, string> = {
  metro: 'METRO Deutschland',
  chefs: 'CHEFS CULINAR',
}

export function resolveSupplierLabel(
  name?: string | null,
  matchKey?: string | null,
): string {
  if (name) return name
  const prefix = matchKey?.split(':')[0]
  return (prefix && SUPPLIER_BY_PREFIX[prefix]) || '—'
}
