'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { useIngredients } from '@/hooks/use-ingredients'
import { useSupplierAssignment, useSetPreferredAny } from '@/hooks/use-supplier-articles'
import { getErrorMessage } from '@/lib/errors'
import { resolveSupplierLabel } from '@/lib/supplier-label'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/state'
import type { IngredientCandidates } from '@/services/supplier-articles.service'
import type { IngredientSupplierArticleJoined } from '@/types'

const NONE = '__none__'

function ekPrice(value: number | null | undefined, currency: string | null | undefined, unit: string | null | undefined): string {
  if (value == null) return '—'
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 4,
  }).format(value)
  return unit ? `${formatted} / ${unit}` : formatted
}

function mappingLabel(m: IngredientSupplierArticleJoined): string {
  const a = m.supplier_article
  const supplier = resolveSupplierLabel(a?.supplier?.name, a?.match_key)
  const article = a?.clean_article_name_de ?? a?.raw_article_name ?? 'Artikel'
  return `${supplier} · ${article}`
}

function CandidatePicker({
  group, busy, onPick,
}: {
  group: IngredientCandidates
  busy: boolean
  onPick: (ingredientId: string, mappingId: string | null) => void
}) {
  const value = group.preferred?.id ?? NONE
  return (
    <Select
      value={value}
      disabled={busy}
      onValueChange={(v) => onPick(group.ingredient.id, v === NONE ? null : v)}
    >
      <SelectTrigger className="w-full min-w-[16rem]">
        <SelectValue placeholder="Lieferant wählen…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          <span className="text-muted-foreground">— keiner —</span>
        </SelectItem>
        {group.mappings.map((m) => {
          const a = m.supplier_article
          return (
            <SelectItem key={m.id} value={m.id}>
              <span className="font-medium">{mappingLabel(m)}</span>
              <span className="ml-1 text-muted-foreground tabular-nums">
                · {ekPrice(a?.ek_price_per_base_unit, a?.currency, a?.base_unit)}
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground">
                · {m.match_type}·{m.match_score}{m.needs_review ? ' ⚠' : ''}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default function SupplierAssignmentPage() {
  const { data: ingredients = [], isLoading: ingLoading } = useIngredients()
  const { data: groups = [], isLoading: candLoading, isError, error } = useSupplierAssignment()
  const setPreferred = useSetPreferredAny()
  const [search, setSearch] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const byIngredient = useMemo(() => {
    const m = new Map<string, IngredientCandidates>()
    for (const g of groups) m.set(g.ingredient.id, g)
    return m
  }, [groups])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ingredients
      .map((ing) => ({ ing, group: byIngredient.get(ing.id) ?? null }))
      .filter(({ ing, group }) => {
        if (onlyOpen && group?.preferred) return false
        if (!q) return true
        return ing.name.toLowerCase().includes(q) || ing.ingredient_code.toLowerCase().includes(q)
      })
      .sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'de'))
  }, [ingredients, byIngredient, search, onlyOpen])

  const stats = useMemo(() => {
    let withPreferred = 0, openWithCandidates = 0, noCandidates = 0
    for (const ing of ingredients) {
      const g = byIngredient.get(ing.id)
      if (g?.preferred) withPreferred++
      else if (g && g.mappings.length > 0) openWithCandidates++
      else noCandidates++
    }
    return { total: ingredients.length, withPreferred, openWithCandidates, noCandidates }
  }, [ingredients, byIngredient])

  async function handlePick(ingredientId: string, mappingId: string | null) {
    setPendingId(ingredientId)
    try {
      await setPreferred.mutateAsync({ ingredientId, mappingId })
      toast.success(mappingId ? 'Bevorzugter Lieferant gesetzt' : 'Bevorzugung aufgehoben')
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setPendingId(null)
    }
  }

  const isLoading = ingLoading || candLoading

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Lieferanten-Zuordnung"
        description="Je Zutat den bevorzugten Lieferantenartikel (EK) aus den Kandidaten wählen"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/master-data/ingredients"><ArrowLeft className="h-4 w-4" /> Zutaten</Link>
          </Button>
        }
      />
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {isError && <ErrorState error={error} title="Zuordnungen konnten nicht geladen werden" />}

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">Gesamt {stats.total}</Badge>
          <Badge variant="success">Bevorzugt gesetzt {stats.withPreferred}</Badge>
          <Badge variant="warning">Offen (mit Kandidaten) {stats.openWithCandidates}</Badge>
          <Badge variant="secondary">Ohne Kandidaten {stats.noCandidates}</Badge>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zutat nach Name oder Code suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
            Nur offene anzeigen
          </label>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Zutat</TableHead>
                  <TableHead className="w-[22rem]">Bevorzugter Lieferant (EK)</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Laden…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    {onlyOpen ? 'Keine offenen Zutaten — alle mit Kandidaten haben einen bevorzugten Lieferanten. ✓' : 'Keine Zutaten gefunden.'}
                  </TableCell></TableRow>
                ) : (
                  rows.map(({ ing, group }) => {
                    const busy = pendingId === ing.id
                    const hasCandidates = !!group && group.mappings.length > 0
                    return (
                      <TableRow key={ing.id}>
                        <TableCell>
                          <Link href={`/master-data/ingredients/${ing.id}`} className="hover:underline">
                            <Badge variant="outline">{ing.ingredient_code}</Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link href={`/master-data/ingredients/${ing.id}`} className="hover:underline">{ing.name}</Link>
                          {ing.category && <span className="ml-2 text-xs text-muted-foreground">{ing.category}</span>}
                        </TableCell>
                        <TableCell>
                          {hasCandidates ? (
                            <div className="flex items-center gap-2">
                              <CandidatePicker group={group!} busy={busy} onPick={handlePick} />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">{group!.mappings.length} Kand.</span>
                            </div>
                          ) : (
                            <Link
                              href={`/master-data/ingredients/${ing.id}/edit`}
                              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                            >
                              Keine Kandidaten — manuell anlegen <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </TableCell>
                        <TableCell>
                          {busy ? (
                            <span className="text-xs text-muted-foreground">Speichern…</span>
                          ) : group?.preferred ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Gesetzt
                            </span>
                          ) : hasCandidates ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" /> Offen
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
