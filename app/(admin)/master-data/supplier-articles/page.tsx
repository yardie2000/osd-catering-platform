'use client'

import { memo, useState } from 'react'
import Link from 'next/link'
import { Search, FileUp, Link2, Truck } from 'lucide-react'

import { useSupplierArticleList } from '@/hooks/use-supplier-articles'
import { useVirtualRows } from '@/hooks/use-virtual-rows'
import { PageHeader } from '@/components/layout/page-header'
import { PageContent } from '@/components/layout/page-content'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadingState, EmptyState, ErrorState } from '@/components/ui/state'
import type { SupplierArticleListRow } from '@/services/supplier-articles.service'

const ROW_HEIGHT = 52
const VIRTUALIZE_THRESHOLD = 80

function ek(value: number | null, currency: string, unit: string | null): string {
  if (value == null) return '—'
  const f = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 4 }).format(value)
  return unit ? `${f} / ${unit}` : f
}

const ArticleRow = memo(function ArticleRow({ a }: { a: SupplierArticleListRow }) {
  return (
    <TableRow style={{ height: ROW_HEIGHT }}>
      <TableCell className="font-medium max-w-[26rem] truncate">{a.articleName}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">{a.articleNumber ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">{a.supplierName ?? '—'}</TableCell>
      <TableCell className="tabular-nums whitespace-nowrap">{ek(a.ekPerBaseUnit, a.currency, a.baseUnit)}</TableCell>
      <TableCell>
        {a.ingredient ? (
          <Link href={`/master-data/ingredients/${a.ingredient.id}`} className="inline-flex items-center gap-1 font-medium hover:underline">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> {a.ingredient.name}
          </Link>
        ) : (
          <Badge variant="warning">offen</Badge>
        )}
      </TableCell>
    </TableRow>
  )
})

export default function SupplierArticlesPage() {
  const [search, setSearch] = useState('')
  const { data: articles = [], isLoading, isError, error } = useSupplierArticleList(search)

  const { scrollRef, window: win } = useVirtualRows({ count: articles.length, rowHeight: ROW_HEIGHT })
  const virtual = articles.length > VIRTUALIZE_THRESHOLD
  const visible = virtual ? articles.slice(win.start, win.end) : articles
  const openCount = articles.filter((a) => !a.ingredient).length

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Lieferantenartikel"
        description="Katalog aller je bestellten Einkaufsartikel (EK) — Quelle für Rezept-/Zutatenpflege"
      />
      <PageContent>
        {isError && <ErrorState error={error} title="Lieferantenartikel konnten nicht geladen werden" />}

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><FileUp className="h-4 w-4" /> Lieferantenartikel aus Rechnungen importieren</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Hier entsteht der Rechnungs-Import (Metro, Chefs Culinar): hochgeladene Rechnungen werden zu
            Lieferantenartikeln in diesem Katalog. Für die Umsetzung wird eine Beispiel-Rechnung im Originalformat
            benötigt (PDF oder Lieferanten-CSV), damit das Parsing fachlich korrekt aufgesetzt werden kann.
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Artikel, Artikelnummer suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Truck className="h-3.5 w-3.5" />
            <span>{articles.length} Artikel · {openCount} ohne Zutaten-Zuordnung</span>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <LoadingState label="Lieferantenartikel werden geladen…" />
            ) : articles.length === 0 ? (
              <EmptyState title="Keine Lieferantenartikel gefunden" description="Suche anpassen oder Rechnungen importieren." />
            ) : (
              <div ref={scrollRef} className="max-h-[64vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead>Artikelnr.</TableHead>
                      <TableHead>Lieferant</TableHead>
                      <TableHead>EK / Basis</TableHead>
                      <TableHead>Zutat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {virtual && win.padTop > 0 && <tr aria-hidden><td colSpan={5} style={{ height: win.padTop, padding: 0 }} /></tr>}
                    {visible.map((a) => <ArticleRow key={a.id} a={a} />)}
                    {virtual && win.padBottom > 0 && <tr aria-hidden><td colSpan={5} style={{ height: win.padBottom, padding: 0 }} /></tr>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageContent>
    </div>
  )
}
