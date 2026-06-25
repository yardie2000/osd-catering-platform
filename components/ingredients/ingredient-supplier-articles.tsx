'use client'

import { useState } from 'react'
import { Star, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react'

import { useIngredientSupplierArticles } from '@/hooks/use-supplier-articles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { IngredientSupplierArticleJoined, SupplierArticleWithSupplier } from '@/types'

// Lieferant: bevorzugt der echte (eingebettete) Name; Fallback aus dem
// match_key-Präfix (metro:/chefs:), falls die anon-Rolle die suppliers-Zeile
// (noch) nicht lesen darf. Sobald die anon-SELECT-Policy auf suppliers aktiv
// ist, greift automatisch der echte Name.
const SUPPLIER_BY_PREFIX: Record<string, string> = {
  metro: 'METRO Deutschland',
  chefs: 'CHEFS CULINAR',
}

function supplierLabel(article: SupplierArticleWithSupplier | null | undefined): string {
  if (!article) return '—'
  if (article.supplier?.name) return article.supplier.name
  const prefix = article.match_key?.split(':')[0]
  return (prefix && SUPPLIER_BY_PREFIX[prefix]) || '—'
}

function ekPrice(value: number | null, currency: string | null, unit: string | null) {
  if (value == null) return '—'
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 4,
  }).format(value)
  return unit ? `${formatted} / ${unit}` : formatted
}

const MATCH_VARIANT: Record<string, 'success' | 'secondary' | 'warning' | 'outline'> = {
  exakt: 'success',
  starker_name: 'secondary',
  synonym: 'secondary',
  mehrdeutig: 'warning',
  manuell: 'outline',
}

function MatchBadge({ type, score }: { type: string; score: number }) {
  return (
    <Badge variant={MATCH_VARIANT[type] ?? 'outline'} className="text-[10px] px-1.5">
      {type} · {score}
    </Badge>
  )
}

function ArticleRow({ row, preferred }: { row: IngredientSupplierArticleJoined; preferred?: boolean }) {
  const a = row.supplier_article
  if (!a) return null
  const gebinde = [a.content_quantity, a.content_unit].filter(Boolean).join(' ')
  return (
    <TableRow className={preferred ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : undefined}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          {preferred && <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />}
          {supplierLabel(a)}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>{a.clean_article_name_de ?? a.raw_article_name ?? '—'}</span>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {a.is_bio && <Badge variant="success" className="text-[9px] px-1">Bio</Badge>}
            {a.is_frozen && <Badge variant="outline" className="text-[9px] px-1">TK</Badge>}
            {a.supplier_article_number && (
              <span className="text-[10px] text-muted-foreground">Art. {a.supplier_article_number}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{gebinde || '—'}</TableCell>
      <TableCell className="whitespace-nowrap font-medium tabular-nums">
        {ekPrice(a.ek_price_per_base_unit, a.currency, a.base_unit)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">
        {a.tax_rate_percent != null ? `${a.tax_rate_percent} %` : '—'}
      </TableCell>
      <TableCell>
        {preferred && <Badge variant="success" className="mr-1 text-[10px] px-1.5">Bevorzugt</Badge>}
        <MatchBadge type={row.match_type} score={row.match_score} />
      </TableCell>
    </TableRow>
  )
}

export function IngredientSupplierArticles({ ingredientId }: { ingredientId: string }) {
  const { data, isLoading } = useIngredientSupplierArticles(ingredientId)
  const [showReview, setShowReview] = useState(false)

  const rows = data ?? []
  const secure = rows.filter((r) => !r.needs_review)
  const review = rows.filter((r) => r.needs_review)
  const preferred = secure.find((r) => r.is_preferred)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Lieferantenartikel &amp; EK</CardTitle>
        <span className="text-xs text-muted-foreground">
          {rows.length} Artikel · {secure.length} sicher · {review.length} zur Prüfung
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Lieferantenartikel zugeordnet.
          </p>
        ) : (
          <>
            {preferred?.supplier_article && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/20">
                <span className="text-muted-foreground">Bevorzugter EK: </span>
                <span className="font-medium">{supplierLabel(preferred.supplier_article)}</span>
                {' — '}
                <span className="font-medium tabular-nums">
                  {ekPrice(
                    preferred.supplier_article.ek_price_per_base_unit,
                    preferred.supplier_article.currency,
                    preferred.supplier_article.base_unit,
                  )}
                </span>
              </div>
            )}

            {secure.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lieferant</TableHead>
                    <TableHead>Artikel</TableHead>
                    <TableHead>Inhalt</TableHead>
                    <TableHead>EK (netto)</TableHead>
                    <TableHead className="text-right">MwSt</TableHead>
                    <TableHead>Match</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secure.map((r) => (
                    <ArticleRow key={r.id} row={r} preferred={r.is_preferred} />
                  ))}
                </TableBody>
              </Table>
            )}

            {review.length > 0 && (
              <div className="rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setShowReview((v) => !v)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium"
                >
                  {showReview ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Zur Prüfung ({review.length})
                </button>
                {showReview && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lieferant</TableHead>
                        <TableHead>Artikel</TableHead>
                        <TableHead>EK (netto)</TableHead>
                        <TableHead>Match</TableHead>
                        <TableHead>Grund</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {review.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {supplierLabel(r.supplier_article)}
                          </TableCell>
                          <TableCell>{r.supplier_article?.clean_article_name_de ?? '—'}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {ekPrice(
                              r.supplier_article?.ek_price_per_base_unit ?? null,
                              r.supplier_article?.currency ?? null,
                              r.supplier_article?.base_unit ?? null,
                            )}
                          </TableCell>
                          <TableCell>
                            <MatchBadge type={r.match_type} score={r.match_score} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.review_reason ?? '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              EK = Netto-Einkaufspreise aus Lieferantenrechnungen. Verkaufspreise (VK) werden hier
              bewusst nicht geführt.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
