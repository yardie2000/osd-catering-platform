'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileUp, ChefHat, AlertTriangle, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { useMenus } from '@/hooks/use-menus'
import { useCreateBatch } from '@/hooks/use-batches'
import { batchService } from '@/services/batch.service'
import { getErrorMessage } from '@/lib/errors'
import { parseProduktbedarfCsv, type ProduktbedarfRow } from '@/lib/produktbedarf/parse'
import { suggestMatch, type MenuCandidate } from '@/lib/produktbedarf/match'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/state'

const SKIP = '__skip__'

type Mapping = { menuId: string | null; pax: number }

function todayLabel() {
  return new Date().toLocaleDateString('de-DE')
}

export default function BedarfImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: menus = [], isLoading: menusLoading, isError: menusError, error: menusErrorValue } = useMenus()
  const createBatch = useCreateBatch()

  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ProduktbedarfRow[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [batchName, setBatchName] = useState('')
  const [creating, setCreating] = useState(false)

  const candidates: MenuCandidate[] = useMemo(
    () => menus.map((m) => ({ id: m.id, text: `${m.menu_name} ${m.menu_code}` })),
    [menus],
  )

  function autoMatch(parsed: ProduktbedarfRow[]): Mapping[] {
    return parsed.map((row) => {
      // Skip rows that carry no usable pax demand by default.
      const isPax = /pax/i.test(row.einheit)
      if (row.menge <= 0 || !isPax) return { menuId: null, pax: row.menge }
      const hit = suggestMatch(`${row.produkt} ${row.langbezeichnung}`, candidates)
      return { menuId: hit?.id ?? null, pax: row.menge }
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
      prev.map((m, i) => (i === index ? { ...m, menuId: value === SKIP ? null : value } : m)),
    )
  }

  function setPax(index: number, value: string) {
    const pax = Number(value)
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, pax: Number.isFinite(pax) ? pax : 0 } : m)),
    )
  }

  // Aggregate matched rows by menu so two products mapped to the same menu sum
  // their pax instead of the second silently overwriting the first.
  const plan = useMemo(() => {
    const byMenu = new Map<string, number>()
    rows.forEach((_, i) => {
      const m = mappings[i]
      if (m?.menuId && m.pax > 0) byMenu.set(m.menuId, (byMenu.get(m.menuId) ?? 0) + m.pax)
    })
    const matchedRows = mappings.filter((m) => m.menuId && m.pax > 0).length
    const totalPax = [...byMenu.values()].reduce((s, n) => s + n, 0)
    return { byMenu, matchedRows, menuCount: byMenu.size, totalPax }
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

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Bedarf importieren"
        description="MouseClick-Produktbedarf (CSV) einlesen, Produkte den Menüs zuordnen und daraus einen Produktionslauf erzeugen."
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {menusError && <ErrorState error={menusErrorValue} title="Menüs konnten nicht für das Matching geladen werden" />}
        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-4 w-4" /> Produktbedarf-CSV hochladen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export aus MouseClick → Statistik {'„Produktbedarf"'}. Erwartete Spalten:{' '}
              <code className="text-foreground bg-muted px-1 rounded">Produkt</code>,{' '}
              <code className="text-foreground bg-muted px-1 rounded">Menge</code>,{' '}
              <code className="text-foreground bg-muted px-1 rounded">Einheit</code>,{' '}
              <code className="text-foreground bg-muted px-1 rounded">Klassifizierung</code>.
            </p>
            <div
              className="min-h-36 rounded-lg border-2 border-dashed border-border p-6 text-center cursor-pointer transition-colors hover:border-primary/50 sm:p-8"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Zum Hochladen klicken</p>
              <p className="text-xs text-muted-foreground mt-1">.csv-Dateien {fileName && `· zuletzt: ${fileName}`}</p>
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
            {!menusLoading && !menusError && menus.length === 0 && (
              <p className="flex items-center gap-2 text-xs text-amber-500">
                <AlertTriangle className="h-4 w-4" /> Es sind noch keine Menüs im Katalog — ohne Menüs kann nichts zugeordnet werden.
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
                  <p className="text-2xl font-semibold">{plan.matchedRows}<span className="text-sm text-muted-foreground"> / {rows.length}</span></p>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground">Menüs</p>
                  <p className="text-2xl font-semibold">{plan.menuCount}</p>
                </div>
                <div className="text-sm">
                  <p className="text-muted-foreground">Personen gesamt</p>
                  <p className="text-2xl font-semibold">{plan.totalPax}</p>
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button variant="outline" onClick={reMatch} disabled={menus.length === 0}>
                    <Wand2 className="h-4 w-4" /> Auto-Zuordnung
                  </Button>
                  <Button onClick={createBatchFromPlan} disabled={creating || plan.menuCount === 0}>
                    <ChefHat className="h-4 w-4" /> {creating ? 'Wird angelegt…' : 'Produktionslauf anlegen'}
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
                      <TableHead>Produkt</TableHead>
                      <TableHead className="w-28">Bedarf</TableHead>
                      <TableHead className="w-40">Klassifizierung</TableHead>
                      <TableHead className="min-w-[18rem]">Menü-Zuordnung</TableHead>
                      <TableHead className="w-28">Personen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => {
                      const m = mappings[i]
                      const skipped = !m?.menuId
                      return (
                        <TableRow key={i} className={skipped ? 'opacity-60' : undefined}>
                          <TableCell className="align-top">
                            <p className="font-medium">{row.produkt}</p>
                            {row.langbezeichnung && (
                              <p className="text-xs text-muted-foreground max-w-[24rem] truncate" title={row.langbezeichnung}>
                                {row.langbezeichnung}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="align-top text-muted-foreground">
                            {row.menge} {row.einheit || '—'}
                          </TableCell>
                          <TableCell className="align-top">
                            {row.istOptional ? (
                              <Badge variant="warning" className="text-[10px]">Optional / Add-on</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">{row.klassifizierung || '—'}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="align-top">
                            <Select value={m?.menuId ?? SKIP} onValueChange={(v) => setMenu(i, v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Menü wählen…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SKIP}>— Überspringen —</SelectItem>
                                {menus.map((menu) => (
                                  <SelectItem key={menu.id} value={menu.id}>
                                    {menu.menu_name} <span className="text-muted-foreground">({menu.menu_code})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
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
  )
}
