'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useBatches, useBatchOutputs } from '@/hooks/use-batches'
import type { PurchasingLine } from '@/lib/purchasing/aggregate'
import { DEFAULT_CALC_CONFIG } from '@/lib/purchasing/aggregate'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Printer, Download, AlertTriangle, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { nf, cf, QtyCell, Stat, StickyBar } from '@/components/operations/output-ui'

const UNCATEGORIZED = 'Ohne Kategorie'

function PurchasingOutputInner() {
  const params = useSearchParams()
  const { data: batches = [] } = useBatches()
  const [batchId, setBatchId] = useState(params.get('batch') ?? '')

  const { data: outputs, isLoading } = useBatchOutputs(batchId)
  const result = outputs?.purchasing
  const batch = outputs?.batch

  const groups = useMemo(() => {
    const lines = result?.lines ?? []
    const map = new Map<string, PurchasingLine[]>()
    for (const l of lines) {
      const key = l.category?.trim() || UNCATEGORIZED
      const arr = map.get(key) ?? []
      arr.push(l)
      map.set(key, arr)
    }
    return [...map.entries()]
      .map(([category, items]) => ({ category, items: items.slice().sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name, 'de')) }))
      .sort((a, b) => a.category.localeCompare(b.category, 'de'))
  }, [result])

  const totals = useMemo(() => {
    const lines = result?.lines ?? []
    return {
      positions:   lines.length,
      orderable:   lines.filter((l) => l.unit_class !== 'qualitative').length,
      qualitative: lines.filter((l) => l.unit_class === 'qualitative').length,
      categories:  groups.length,
    }
  }, [result, groups])

  const hasResult = !!result && result.lines.length > 0

  function exportCsv() {
    if (!result) return
    const head = ['Kategorie', 'Zutat', 'Code', 'Netto', 'Produktion', 'Einkauf', 'Einheit', 'Klasse', 'Lieferant', 'Einzelpreis', 'Kosten']
    const body: string[][] = []
    for (const g of groups) for (const l of g.items) {
      const qual = l.unit_class === 'qualitative'
      body.push([
        g.category, l.ingredient_name, l.ingredient_code,
        qual ? 'n. Bedarf' : nf.format(l.required_quantity),
        qual ? 'n. Bedarf' : nf.format(l.production_quantity),
        qual ? 'n. Bedarf' : nf.format(l.quantity),
        l.unit_label, l.unit_class,
        l.supplier_name ?? '', l.unit_price != null ? l.unit_price.toFixed(4) : '', l.est_cost != null ? l.est_cost.toFixed(2) : '',
      ])
    }
    const cell = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const csv = '﻿' + [head, ...body].map((r) => r.map(cell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `einkauf_${(batch?.name || 'batch').replace(/[^\w-]+/g, '_')}.csv`; a.click()
    URL.revokeObjectURL(url); toast.success('CSV exportiert')
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Purchasing Output"
        description="Einkaufsmengen aggregiert nach Kategorie — Produktion ÷ Yield %"
        actions={
          hasResult ? (
            <div className="flex gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Sheet</Button>
              <Button size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
            </div>
          ) : undefined
        }
      />

      <StickyBar>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="min-w-[15rem] print:hidden">
            <Select value={batchId || undefined} onValueChange={setBatchId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Batch wählen…" /></SelectTrigger>
              <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {hasResult && (
            <>
              <Stat label="Positionen" value={totals.positions} sub={`${totals.categories} Kategorien`} />
              <Stat label="Bestellbar" value={totals.orderable} tone="primary" />
              {totals.qualitative > 0 && <Stat label="n. Bedarf" value={totals.qualitative} tone="muted" />}
              <Stat label="Yield" value={`${nf.format(DEFAULT_CALC_CONFIG.yieldPct)} %`} tone="muted" sub="Einkauf = Prod. ÷ Yield" />
              {result!.totalCost != null && <Stat label="Kosten (geschätzt)" value={cf.format(result!.totalCost)} tone="primary" />}
              {batch && (
                <Link href={`/operations/batches/${batch.id}`} className="ml-auto text-sm text-primary hover:underline print:hidden">Batch bearbeiten →</Link>
              )}
            </>
          )}
        </div>
      </StickyBar>

      <div className="p-6 lg:p-8 space-y-5">
        {hasResult && batch && (
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">Purchasing Sheet</h1>
            <p className="text-sm">{batch.name}{batch.production_date ? ` · ${new Date(batch.production_date).toLocaleDateString('de-DE')}` : ''}</p>
          </div>
        )}

        {result && result.warnings.length > 0 && (
          <Card className="border-amber-500/40 print:hidden">
            <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-2 text-amber-500 font-medium"><AlertTriangle className="h-4 w-4" /> Hinweise ({result.warnings.length})</p>
              {result.warnings.map((w, i) => (
                <div key={i}><span className="text-foreground">{w.menu}</span> — {w.kind === 'no_recipe' ? 'Position ohne Rezept' : 'Rezept ohne Zutaten'}: {w.detail}</div>
              ))}
            </CardContent>
          </Card>
        )}

        {!hasResult ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <ShoppingCart className="h-6 w-6 mx-auto opacity-50 mb-2" />
            {!batchId ? 'Batch wählen, um die Einkaufsliste zu sehen.' : isLoading ? 'Berechne…' : 'Dieser Batch ergibt keine Zutaten (Menüs/Pax/Rezept-Verknüpfung prüfen).'}
          </CardContent></Card>
        ) : (
          groups.map((g) => (
            <Card key={g.category} className="break-inside-avoid overflow-hidden">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                <p className="text-sm font-semibold">{g.category}</p>
                <span className="text-xs text-muted-foreground tabular-nums">{g.items.length} Positionen</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8">Zutat</TableHead>
                    <TableHead className="h-8 text-right">Netto</TableHead>
                    <TableHead className="h-8 text-right">Produktion</TableHead>
                    <TableHead className="h-8 text-right">Einkauf</TableHead>
                    <TableHead className="h-8">Lieferant</TableHead>
                    <TableHead className="h-8 text-right">Kosten</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.items.map((l) => (
                    <TableRow key={`${l.ingredient_id}:${l.unit_id}`} className="border-border/60">
                      <TableCell className="py-1.5 font-medium">
                        {l.ingredient_name}
                        <span className="ml-2 text-[11px] text-muted-foreground font-mono">{l.ingredient_code}</span>
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-muted-foreground"><QtyCell value={l.required_quantity} unitClass={l.unit_class} unitLabel={l.unit_label} /></TableCell>
                      <TableCell className="py-1.5 text-right text-muted-foreground"><QtyCell value={l.production_quantity} unitClass={l.unit_class} unitLabel={l.unit_label} /></TableCell>
                      <TableCell className="py-1.5 text-right"><QtyCell value={l.quantity} unitClass={l.unit_class} unitLabel={l.unit_label} bold /></TableCell>
                      <TableCell className="py-1.5 text-sm">{l.supplier_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="py-1.5 text-right tabular-nums">{l.est_cost != null ? cf.format(l.est_cost) : <span className="text-muted-foreground">—</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default function PurchasingOutputPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Laden…</div>}>
      <PurchasingOutputInner />
    </Suspense>
  )
}
