'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileUp,
  ChefHat,
  AlertTriangle,
  Wand2,
  CheckCircle2,
  CircleHelp,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { useMenus } from '@/hooks/use-menus'
import { useMatcherContext } from '@/hooks/use-matcher-context'
import { useCreateBatch } from '@/hooks/use-batches'
import { batchService } from '@/services/batch.service'
import { getErrorMessage } from '@/lib/errors'
import { parseProduktbedarfCsv, type ProduktbedarfRow } from '@/lib/produktbedarf/parse'
import { matchProdukt, type MatchResult, type MatchStrategy } from '@/lib/produktbedarf/menuMatcher'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const SKIP = '__skip__'

type Mapping = {
  menuId: string | null
  pax: number
  matchResult: MatchResult | null
}

function todayLabel() {
  return new Date().toLocaleDateString('de-DE')
}

// ── Strategy badge helpers ────────────────────────────────────────────────────

const STRATEGY_LABEL: Record<MatchStrategy, string> = {
  'exact-menu':          'Exakt',
  'fuzzy-menu':          'Fuzzy-Menü',
  'menu-position-split': 'Menü+Position',
  'position-only':       'Position',
  'needs-review':        'Prüfen',
  'no-match':            'Kein Treffer',
}

function ConfidenceIcon({ result }: { result: MatchResult | null }) {
  if (!result || result.strategy === 'no-match') {
    return <XCircle className="h-4 w-4 text-destructive" />
  }
  if (result.needsReview) {
    return <CircleHelp className="h-4 w-4 text-amber-500" />
  }
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
}

function StrategyBadge({ result }: { result: MatchResult | null }) {
  if (!result) return null
  const label = STRATEGY_LABEL[result.strategy]
  if (result.strategy === 'no-match') {
    return <Badge variant="destructive" className="text-[10px]">{label}</Badge>
  }
  if (result.needsReview) {
    return <Badge variant="warning" className="text-[10px]">{label}</Badge>
  }
  return <Badge variant="secondary" className="text-[10px]">{label} {Math.round(result.confidence * 100)} %</Badge>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BedarfImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: menus = [], isLoading: menusLoading } = useMenus()
  const { context, isLoading: contextLoading } = useMatcherContext()
  const createBatch = useCreateBatch()

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ProduktbedarfRow[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [batchName, setBatchName] = useState('')
  const [creating, setCreating] = useState(false)

  // Use the deep matcher when context (positions) is loaded; fall back to
  // menu-only matching when positions haven't been set up yet.
  function autoMatch(parsed: ProduktbedarfRow[]): Mapping[] {
    return parsed.map((row) => {
      const isPax = /pax/i.test(row.einheit)
      if (row.menge <= 0 || !isPax) return { menuId: null, pax: row.menge, matchResult: null }

      const result = matchProdukt(row.produkt, row.langbezeichnung, context)
      return {
        menuId: result.matchedMenuId,
        pax: row.menge,
        matchResult: result,
      }
    })
  }

  async function onFile(file: File) {
    try {
      const text = await file.text()
      const parsed = parseProduktbedarfCsv(text)
      if (parsed.length === 0) {
        toast.error('Keine Produkte in der Datei gefunden.')
        return
      }
      setRows(parsed)
      setMappings(autoMatch(parsed))
      setFileName(file.name)
      if (!batchName) setBatchName(`MouseClick-Import ${todayLabel()}`)
      toast.success(`${parsed.length} Produkte eingelesen`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function reMatch() {
    setMappings(autoMatch(rows))
    toast.success('Automatische Zuordnung neu berechnet')
  }

  function setMenu(index: number, value: string) {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index ? { ...m, menuId: value === SKIP ? null : value } : m,
      ),
    )
  }

  function setPax(index: number, value: string) {
    const pax = Number(value)
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, pax: Number.isFinite(pax) ? pax : 0 } : m)),
    )
  }

  const plan = useMemo(() => {
    const byMenu = new Map<string, number>()
    rows.forEach((_, i) => {
      const m = mappings[i]
      if (m?.menuId && m.pax > 0) byMenu.set(m.menuId, (byMenu.get(m.menuId) ?? 0) + m.pax)
    })
    const matchedRows = mappings.filter((m) => m.menuId && m.pax > 0).length
    const reviewRows = mappings.filter((m) => m.matchResult?.needsReview).length
    const totalPax = [...byMenu.values()].reduce((s, n) => s + n, 0)
    return { byMenu, matchedRows, menuCount: byMenu.size, totalPax, reviewRows }
  }, [rows, mappings])

  async function createBatchFromPlan() {
    if (plan.byMenu.size === 0) {
      toast.error('Keine zugeordneten Produkte mit Personenzahl > 0.')
      return
    }
    setCreating(true)
    try {
      const batch = await createBatch.mutateAsync({
        name: batchName.trim() || `MouseClick-Import ${todayLabel()}`,
        status: 'planned',
        description: fileName ? `Importiert aus ${fileName}` : null,
      })
      for (const [menuId, pax] of plan.byMenu) {
        await batchService.addItem(batch.id, menuId, pax)
      }
      toast.success('Produktionslauf angelegt')
      router.push(`/operations/batches/${batch.id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
      setCreating(false)
    }
  }

  const hasRows = rows.length > 0
  const isLoading = menusLoading || contextLoading

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <PageHeader
          title="Bedarf importieren"
          description="MouseClick-Produktbedarf (CSV) einlesen, Produkte den Menüs zuordnen und daraus einen Produktionslauf erzeugen."
        />

        <div className="p-8 space-y-6">
          {/* Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileUp className="h-4 w-4" /> Produktbedarf-CSV hochladen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export aus MouseClick → Statistik{' '}
                <span className="font-medium text-foreground">„Produktbedarf"</span>. Erwartete
                Spalten:{' '}
                <code className="text-foreground bg-muted px-1 rounded">Produkt</code>,{' '}
                <code className="text-foreground bg-muted px-1 rounded">Menge</code>,{' '}
                <code className="text-foreground bg-muted px-1 rounded">Einheit</code>,{' '}
                <code className="text-foreground bg-muted px-1 rounded">Klassifizierung</code>.
              </p>
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Zum Hochladen klicken</p>
                <p className="text-xs text-muted-foreground mt-1">
                  .csv-Dateien {fileName && `· zuletzt: ${fileName}`}
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onFile(f)
                  }}
                />
              </div>
              {!isLoading && menus.length === 0 && (
                <p className="flex items-center gap-2 text-xs text-amber-500">
                  <AlertTriangle className="h-4 w-4" /> Es sind noch keine Menüs im Katalog —
                  ohne Menüs kann nichts zugeordnet werden.
                </p>
              )}
            </CardContent>
          </Card>

          {hasRows && (
            <>
              {/* Summary + action */}
              <Card>
                <CardContent className="flex flex-wrap items-end gap-x-8 gap-y-4 py-4">
                  <div className="min-w-[16rem] flex-1">
                    <label className="text-xs text-muted-foreground">Name des Produktionslaufs</label>
                    <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} className="mt-1" />
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Zugeordnet</p>
                    <p className="text-2xl font-semibold">
                      {plan.matchedRows}
                      <span className="text-sm text-muted-foreground"> / {rows.length}</span>
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Menüs</p>
                    <p className="text-2xl font-semibold">{plan.menuCount}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Personen gesamt</p>
                    <p className="text-2xl font-semibold">{plan.totalPax}</p>
                  </div>
                  {plan.reviewRows > 0 && (
                    <div className="text-sm">
                      <p className="text-amber-500">Zu prüfen</p>
                      <p className="text-2xl font-semibold text-amber-500">{plan.reviewRows}</p>
                    </div>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button variant="outline" onClick={reMatch} disabled={menus.length === 0}>
                      <Wand2 className="h-4 w-4" /> Auto-Zuordnung
                    </Button>
                    <Button
                      onClick={createBatchFromPlan}
                      disabled={creating || plan.menuCount === 0}
                    >
                      <ChefHat className="h-4 w-4" />{' '}
                      {creating ? 'Wird angelegt…' : 'Produktionslauf anlegen'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Matching table */}
              <Card>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-6" />
                        <TableHead>Produkt</TableHead>
                        <TableHead className="w-28">Bedarf</TableHead>
                        <TableHead className="w-36">Matching</TableHead>
                        <TableHead className="min-w-[18rem]">Menü-Zuordnung</TableHead>
                        <TableHead className="w-28">Personen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, i) => {
                        const m = mappings[i]
                        const skipped = !m?.menuId
                        const result = m?.matchResult ?? null
                        return (
                          <TableRow
                            key={i}
                            className={
                              skipped
                                ? 'opacity-60'
                                : result?.needsReview
                                  ? 'bg-amber-50/40 dark:bg-amber-950/20'
                                  : undefined
                            }
                          >
                            {/* Status icon */}
                            <TableCell className="align-top pt-3 pl-4">
                              <Tooltip>
                                <TooltipTrigger>
                                  <ConfidenceIcon result={result} />
                                </TooltipTrigger>
                                {result && (
                                  <TooltipContent side="right" className="max-w-xs font-mono text-xs">
                                    <pre className="whitespace-pre-wrap">
                                      {result.log.join('\n')}
                                      {result.warnings.length > 0 &&
                                        '\n⚠ ' + result.warnings.join('\n⚠ ')}
                                    </pre>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TableCell>

                            {/* Product name + long description */}
                            <TableCell className="align-top">
                              <p className="font-medium">{row.produkt}</p>
                              {row.langbezeichnung && (
                                <p
                                  className="text-xs text-muted-foreground max-w-[24rem] truncate"
                                  title={row.langbezeichnung}
                                >
                                  {row.langbezeichnung}
                                </p>
                              )}
                              {result?.matchedPositionName && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  Position: {result.matchedPositionName}
                                </p>
                              )}
                            </TableCell>

                            {/* Demand */}
                            <TableCell className="align-top text-muted-foreground">
                              {row.menge} {row.einheit || '—'}
                            </TableCell>

                            {/* Match strategy badge */}
                            <TableCell className="align-top pt-3">
                              {row.istOptional ? (
                                <Badge variant="warning" className="text-[10px]">
                                  Optional / Add-on
                                </Badge>
                              ) : (
                                <StrategyBadge result={result} />
                              )}
                            </TableCell>

                            {/* Menu select */}
                            <TableCell className="align-top">
                              <Select
                                value={m?.menuId ?? SKIP}
                                onValueChange={(v) => setMenu(i, v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Menü wählen…" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SKIP}>— Überspringen —</SelectItem>
                                  {menus.map((menu) => (
                                    <SelectItem key={menu.id} value={menu.id}>
                                      {menu.menu_name}{' '}
                                      <span className="text-muted-foreground">
                                        ({menu.menu_code})
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>

                            {/* Pax */}
                            <TableCell className="align-top">
                              <Input
                                type="number"
                                min={0}
                                value={m?.pax ?? 0}
                                onChange={(e) => setPax(i, e.target.value)}
                                className="h-9 w-24"
                                disabled={skipped}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
