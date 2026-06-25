'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useBatches, useBatchOutputs } from '@/hooks/use-batches'
import { DEFAULT_CALC_CONFIG } from '@/lib/purchasing/aggregate'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Printer, Download, AlertTriangle, Info, ChefHat } from 'lucide-react'
import { toast } from 'sonner'
import { nf, QtyCell, Stat, StickyBar, baseSourceLabel } from '@/components/operations/output-ui'
import { ErrorState } from '@/components/ui/state'

function ProductionOutputInner() {
  const params = useSearchParams()
  const { data: batches = [] } = useBatches()
  const [batchId, setBatchId] = useState(params.get('batch') ?? '')

  const { data: outputs, isLoading, isError, error } = useBatchOutputs(batchId)
  const plan = outputs?.production
  const batch = outputs?.batch
  const hasResult = !!plan && plan.batches.length > 0

  const totals = useMemo(() => {
    const b = plan?.batches ?? []
    const totalPax = (batch?.kitchen_batch_items ?? []).reduce((s, it) => s + (it.pax_count || 0), 0)
    return {
      recipes:  b.length,
      portions: b.reduce((s, x) => s + x.portions_needed, 0),
      withIng:  b.filter((x) => x.has_ingredients).length,
      pax:      totalPax,
    }
  }, [plan, batch])

  function exportCsv() {
    if (!plan) return
    const head = ['Rezept', 'Code', 'Portionen', 'Basis', 'Faktor', 'Verlust%', 'Zutat', 'Netto', 'Produktion', 'Einheit']
    const body: string[][] = []
    for (const b of plan.batches) {
      const meta = [b.recipe_name, b.recipe_code, String(b.portions_needed), nf.format(b.base), nf.format(b.batch_factor), nf.format(b.production_loss_pct)]
      if (b.ingredients.length === 0) body.push([...meta, '(keine Zutaten)', '', '', ''])
      for (const ing of b.ingredients) {
        const qual = ing.unit_class === 'qualitative'
        body.push([...meta, ing.ingredient_name, qual ? 'n. Bedarf' : nf.format(ing.required_quantity), qual ? 'n. Bedarf' : nf.format(ing.quantity), ing.unit_label])
      }
    }
    const cell = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const csv = '﻿' + [head, ...body].map((r) => r.map(cell).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `produktion_${(batch?.name || 'batch').replace(/[^\w-]+/g, '_')}.csv`; a.click()
    URL.revokeObjectURL(url); toast.success('CSV exportiert')
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Produktionsausgabe"
        description="Produktionsmengen je Rezept — Netto × (1 + Verlust %)"
        actions={
          hasResult ? (
            <div className="flex gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Drucken</Button>
              <Button size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
            </div>
          ) : undefined
        }
      />

      {/* sticky control + summary bar */}
      <StickyBar>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="min-w-[15rem] print:hidden">
            <Select value={batchId || undefined} onValueChange={setBatchId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Produktionslauf wählen…" /></SelectTrigger>
              <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {hasResult && (
            <>
              <Stat label="Rezepte" value={totals.recipes} sub={`${totals.withIng} mit Zutaten`} />
              <Stat label="Portionen" value={nf.format(totals.portions)} tone="primary" />
              <Stat label="Personen" value={nf.format(totals.pax)} />
              <Stat label="Verlust" value={`${nf.format(DEFAULT_CALC_CONFIG.productionLossPct)} %`} tone="muted" sub="Produktion = Netto ×1,1" />
              {plan!.assumptions.length > 0 && <Stat label="Basis prüfen" value={plan!.assumptions.length} tone="warning" />}
              {batch && (
                <Link href={`/operations/batches/${batch.id}`} className="ml-auto text-sm text-primary hover:underline print:hidden">Produktionslauf bearbeiten →</Link>
              )}
            </>
          )}
        </div>
      </StickyBar>

      <div className="p-6 lg:p-8 space-y-5">
        {hasResult && batch && (
          <div className="hidden print:block">
            <h1 className="text-xl font-bold">Küchen-Produktionsblatt</h1>
            <p className="text-sm">{batch.name}{batch.production_date ? ` · ${new Date(batch.production_date).toLocaleDateString('de-DE')}` : ''}</p>
          </div>
        )}

        {plan && plan.assumptions.length > 0 && (
          <Card className="border-amber-500/40 print:hidden">
            <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-2 text-amber-400 font-medium"><Info className="h-4 w-4" /> Portionsbasis prüfen ({plan.assumptions.length}) — ohne hinterlegte Basisportionen/Ertrag, Default 50</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                {plan.assumptions.map((a) => (
                  <span key={a.recipe_code}><span className="font-mono">{a.recipe_code}</span> {a.recipe_name} <span className="text-foreground">·{a.base}</span></span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {plan && plan.warnings.length > 0 && (
          <Card className="border-amber-500/40 print:hidden">
            <CardContent className="py-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-center gap-2 text-amber-500 font-medium"><AlertTriangle className="h-4 w-4" /> Positionen ohne Rezept ({plan.warnings.length})</p>
              {plan.warnings.map((w, i) => <div key={i}><span className="text-foreground">{w.menu}</span> — {w.detail}</div>)}
            </CardContent>
          </Card>
        )}
        {isError && (
          <ErrorState error={error} title="Produktionsausgabe konnte nicht berechnet werden" />
        )}

        {!hasResult && !isError ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <ChefHat className="h-6 w-6 mx-auto opacity-50 mb-2" />
            {!batchId ? 'Produktionslauf wählen, um den Produktionsplan zu sehen.' : isLoading ? 'Berechne…' : 'Dieser Produktionslauf hat keine produzierbaren Rezepte (Menüs/Personenzahl/Rezept-Verknüpfung prüfen).'}
          </CardContent></Card>
        ) : hasResult ? (
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {plan.batches.map((b) => {
              const src = baseSourceLabel(b.source)
              return (
                <Card key={b.recipe_id} className="break-inside-avoid overflow-hidden">
                  <div className="flex items-start justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-tight truncate">{b.recipe_name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{b.recipe_code} · {b.menus.join(', ')}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary" className="tabular-nums">{b.portions_needed} Pt · ×{nf.format(b.batch_factor)}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${src.tone}`}>{src.text} · Basis {nf.format(b.base)}</Badge>
                    </div>
                  </div>
                  {b.has_ingredients ? (
                    <Table className="min-w-[420px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="h-8">Zutat</TableHead>
                          <TableHead className="h-8 text-right">Netto</TableHead>
                          <TableHead className="h-8 text-right">Produktion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {b.ingredients.map((ing, i) => (
                          <TableRow key={i} className="border-border/60">
                            <TableCell className="py-1.5 font-medium">{ing.ingredient_name}</TableCell>
                            <TableCell className="py-1.5 text-right text-muted-foreground"><QtyCell value={ing.required_quantity} unitClass={ing.unit_class} unitLabel={ing.unit_label} /></TableCell>
                            <TableCell className="py-1.5 text-right"><QtyCell value={ing.quantity} unitClass={ing.unit_class} unitLabel={ing.unit_label} bold /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : <p className="px-4 py-3 text-xs text-muted-foreground">Keine Zutaten hinterlegt — nur Mengenskalierung.</p>}
                </Card>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function ProductionOutputPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground">Laden…</div>}>
      <ProductionOutputInner />
    </Suspense>
  )
}
