'use client'

import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Search, ChevronRight, ChevronDown, GitMerge, BookOpen, Carrot, Keyboard } from 'lucide-react'
import { toast } from 'sonner'

import {
  usePositions, useCreatePosition, useUpdatePosition, useDeletePosition,
} from '@/hooks/use-positions'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { PageContent } from '@/components/layout/page-content'
import { PositionInlineEditor } from '@/components/master-data/positions/position-inline-editor'
import { PositionMergeDialog } from '@/components/master-data/positions/position-merge-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { LoadingState, EmptyState } from '@/components/ui/state'
import { ALLERGENS } from '@/types'
import type { PositionListRow } from '@/services/positions.service'

type FormState = { name: string; dietary: string; default_price: string; notes: string; allergens: string[] }
const EMPTY: FormState = { name: '', dietary: '', default_price: '', notes: '', allergens: [] }

// ── Batch-Filter (Teil 5) ──────────────────────────────────────
type FilterKey = 'all' | 'incomplete' | 'no_components' | 'no_recipe' | 'no_ingredient' | 'single' | 'pdf'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'incomplete', label: 'Bestandteile fehlen (lt. Name)' },
  { key: 'no_components', label: 'Ohne Komponenten' },
  { key: 'no_recipe', label: 'Ohne Rezept' },
  { key: 'no_ingredient', label: 'Ohne Zutaten' },
  { key: 'single', label: 'Nur 1 Komponente' },
  { key: 'pdf', label: 'PDF-Import' },
]

const isPdf = (p: PositionListRow) =>
  (p.position_code?.startsWith('PDF-') ?? false) || (p.notes?.includes('PDF') ?? false)

// Heuristik: erwartete Bestandteile aus dem Positionsnamen (an „|" und „ – " getrennt),
// ohne Auswahl-/Variantenmarker. Dient nur als Hinweis auf evtl. unvollständige Positionen.
const NAME_NOISE = /^(m\/?o|mit|ohne|oder|auch|sommer|winter)\b/i
function expectedParts(name: string): number {
  const parts = new Set<string>()
  for (const seg of name.split('|')) {
    for (const sub of seg.split(/\s[–-]\s/)) {
      const t = sub.trim()
      if (t.length >= 3 && !NAME_NOISE.test(t)) parts.add(t.toLowerCase())
    }
  }
  return Math.max(1, parts.size)
}
const isIncomplete = (p: PositionListRow) => p.componentCount < expectedParts(p.name)

function matchesFilter(p: PositionListRow, f: FilterKey): boolean {
  switch (f) {
    case 'incomplete':    return isIncomplete(p)
    case 'no_components': return p.componentCount === 0
    case 'no_recipe':     return p.recipeCount === 0
    case 'no_ingredient': return p.ingredientCount === 0
    case 'single':        return p.componentCount === 1
    case 'pdf':           return isPdf(p)
    default:              return true
  }
}

function PositionForm({ value, onChange }: { value: FormState; onChange: (v: FormState) => void }) {
  function toggleAllergen(a: string) {
    const has = value.allergens.includes(a)
    onChange({ ...value, allergens: has ? value.allergens.filter((x) => x !== a) : [...value.allergens, a] })
  }
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="z. B. Kartoffelsalat" className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Ernährung</label>
          <Input value={value.dietary} onChange={(e) => onChange({ ...value, dietary: e.target.value })} placeholder="z. B. vegan" className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Standardpreis (€)</label>
          <Input type="number" step="0.01" value={value.default_price} onChange={(e) => onChange({ ...value, default_price: e.target.value })} placeholder="optional" className="mt-1" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Allergene</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <button
              type="button" key={a} onClick={() => toggleAllergen(a)}
              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                value.allergens.includes(a) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >{a}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Notizen</label>
        <Textarea value={value.notes} onChange={(e) => onChange({ ...value, notes: e.target.value })} rows={2} className="mt-1" />
      </div>
    </div>
  )
}

function StatusCell({ p }: { p: PositionListRow }) {
  if (p.componentCount === 0) {
    return <Badge variant="error">Leer</Badge>
  }
  const incomplete = isIncomplete(p)
  return (
    <div className="flex items-center gap-1.5">
      {incomplete
        ? <Badge variant="warning" title={`Hinterlegt ${p.componentCount}, lt. Name ~${expectedParts(p.name)} Bestandteile`}>Bestandteile?</Badge>
        : <Badge variant="success">Vollständig</Badge>}
      {p.recipeCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${p.recipeCount} Rezept-Komponente(n)`}>
          <BookOpen className="h-3 w-3" />{p.recipeCount}
        </span>
      )}
      {p.ingredientCount > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${p.ingredientCount} Zutat-Komponente(n)`}>
          <Carrot className="h-3 w-3" />{p.ingredientCount}
        </span>
      )}
    </div>
  )
}

// Memoisierte Zeile: bei Tastatur-Navigation rendern nur die Zeilen neu, deren
// Auswahl-/Aufklapp-Status sich tatsächlich ändert (nicht alle hunderte Zeilen).
const PositionRow = memo(function PositionRow({
  p, idx, isSel, open, innerRef, onSelect, onToggleOpen, onEdit, onMerge, onDelete,
}: {
  p: PositionListRow
  idx: number
  isSel: boolean
  open: boolean
  innerRef?: React.Ref<HTMLTableRowElement>
  onSelect: (idx: number) => void
  onToggleOpen: (id: string) => void
  onEdit: (p: PositionListRow) => void
  onMerge: (p: PositionListRow) => void
  onDelete: (p: PositionListRow) => void
}) {
  return (
    <TableRow
      ref={innerRef}
      data-selected={isSel}
      onMouseDown={() => onSelect(idx)}
      className={`cursor-pointer ${isSel ? 'bg-accent/40' : ''}`}
      onClick={() => onToggleOpen(p.id)}
    >
      <TableCell className="text-muted-foreground">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </TableCell>
      <TableCell>
        <div className="font-medium">{p.name}</div>
        {p.position_code && <div className="font-mono text-[11px] text-muted-foreground">{p.position_code}</div>}
      </TableCell>
      <TableCell><StatusCell p={p} /></TableCell>
      <TableCell className="text-muted-foreground">{p.dietary ?? '—'}</TableCell>
      <TableCell className="tabular-nums" title="Hinterlegte Komponenten / erwartete Bestandteile lt. Name">
        <span className="font-medium">{p.componentCount}</span>
        <span className="text-xs text-muted-foreground"> / {expectedParts(p.name)}</span>
      </TableCell>
      <TableCell>
        {p.usageCount > 0 ? <Badge variant="secondary">{p.usageCount}</Badge> : <span className="text-muted-foreground text-xs">0</span>}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Stammdaten bearbeiten" onClick={() => onEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" title="Mit anderer Position zusammenführen" onClick={() => onMerge(p)}><GitMerge className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" title="Löschen" onClick={() => onDelete(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
        </div>
      </TableCell>
    </TableRow>
  )
})

export default function PositionsPage() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const { data: positions = [], isLoading } = usePositions(search)
  const createPosition = useCreatePosition()
  const updatePosition = useUpdatePosition()
  const deletePosition = useDeletePosition()

  const [dialog, setDialog] = useState<'create' | { edit: PositionListRow } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [openId, setOpenId] = useState<string | null>(null)
  const [mergeSource, setMergeSource] = useState<PositionListRow | null>(null)
  const [selected, setSelected] = useState(0)
  const tableRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  const rows = useMemo(
    () => positions.filter((p) => matchesFilter(p, filter)),
    [positions, filter]
  )

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: positions.length, incomplete: 0, no_components: 0, no_recipe: 0, no_ingredient: 0, single: 0, pdf: 0 }
    for (const p of positions) {
      if (isIncomplete(p)) c.incomplete++
      if (p.componentCount === 0) c.no_components++
      if (p.recipeCount === 0) c.no_recipe++
      if (p.ingredientCount === 0) c.no_ingredient++
      if (p.componentCount === 1) c.single++
      if (isPdf(p)) c.pdf++
    }
    return c
  }, [positions])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const component = params.get('component')
    const initialSearch = params.get('search')
    if (initialSearch) setSearch(initialSearch)
    if (component) setOpenId(component)
  }, [])

  // Auswahl gültig halten, wenn sich die gefilterte Liste ändert.
  useEffect(() => { setSelected((s) => Math.min(s, Math.max(0, rows.length - 1))) }, [rows.length])

  // Ausgewählte Zeile sichtbar halten.
  useEffect(() => { selectedRowRef.current?.scrollIntoView({ block: 'nearest' }) }, [selected, openId])

  function openCreate() { setForm(EMPTY); setDialog('create') }
  const openEdit = useCallback((p: PositionListRow) => {
    setForm({ name: p.name, dietary: p.dietary ?? '', default_price: p.default_price?.toString() ?? '', notes: p.notes ?? '', allergens: p.allergens ?? [] })
    setDialog({ edit: p })
  }, [])
  const onSelect = useCallback((i: number) => setSelected(i), [])
  const onToggleOpen = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : id)), [])

  function payloadFromForm() {
    return {
      name: form.name.trim(),
      dietary: form.dietary.trim() || null,
      default_price: form.default_price ? Number(form.default_price) : null,
      notes: form.notes.trim() || null,
      allergens: form.allergens,
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name ist erforderlich'); return }
    try {
      if (dialog === 'create') {
        await createPosition.mutateAsync(payloadFromForm())
        toast.success('Position angelegt')
      } else if (dialog && 'edit' in dialog) {
        await updatePosition.mutateAsync({ id: dialog.edit.id, payload: payloadFromForm() })
        toast.success('Position aktualisiert')
      }
      setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  const handleDelete = useCallback(async (p: PositionListRow) => {
    if (p.usageCount > 0) { toast.error(`Position wird in ${p.usageCount} Menü(s) verwendet — dort erst entfernen.`); return }
    if (!confirm(`Position „${p.name}" wirklich löschen?`)) return
    try { await deletePosition.mutateAsync(p.id); toast.success('Position gelöscht') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }, [deletePosition])

  // ── Keyboard-Workflow (Teil 4) ────────────────────────────────
  function isTypingTarget(el: EventTarget | null) {
    const node = el as HTMLElement | null
    if (!node) return false
    if (node.closest?.('[data-inline-editor]')) return true
    const tag = node.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || node.isContentEditable
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') { setOpenId(null); tableRef.current?.focus(); return }
    if (rows.length === 0) return
    const typing = isTypingTarget(e.target)

    // „Speichern & weiter": auch im Editor zur nächsten Position springen.
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const dir = e.key === 'ArrowUp' ? -1 : 1
      const next = Math.min(rows.length - 1, Math.max(0, selected + dir))
      setSelected(next)
      setOpenId(rows[next].id)
      tableRef.current?.focus()
      return
    }

    if (typing) return // im Eingabefeld: normale Tastatur (Tab/Pfeile) nicht abfangen

    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault(); setSelected((s) => Math.min(rows.length - 1, s + 1))
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault(); setSelected((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const p = rows[selected]
      if (p) setOpenId((cur) => (cur === p.id ? null : p.id))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Positionen"
        description="Produktionsmodus — Status auf einen Blick, Komponenten direkt in der Zeile bearbeiten"
        actions={<Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" /> Neue Position</Button>}
      />
      <PageContent>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[16rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Positionen nach Name oder Code suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Keyboard className="h-3.5 w-3.5" />
            <span>↑/↓ wählen · Enter auf-/zuklappen · Strg+Enter speichern &amp; weiter · Esc schließen</span>
          </div>
        </div>

        {/* Batch-Filter (Teil 5) */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 ${filter === f.key ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div ref={tableRef} tabIndex={0} onKeyDown={onKeyDown} className="outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ernährung</TableHead>
                    <TableHead>Komponenten</TableHead>
                    <TableHead>In Menüs</TableHead>
                    <TableHead className="w-24 text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="p-0"><LoadingState label="Positionen werden geladen…" /></TableCell></TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="p-0"><EmptyState title="Keine Positionen für diesen Filter" /></TableCell></TableRow>
                  ) : (
                    rows.map((p, idx) => {
                      const open = openId === p.id
                      const isSel = idx === selected
                      return (
                        <Fragment key={p.id}>
                          <PositionRow
                            p={p}
                            idx={idx}
                            isSel={isSel}
                            open={open}
                            innerRef={isSel ? selectedRowRef : undefined}
                            onSelect={onSelect}
                            onToggleOpen={onToggleOpen}
                            onEdit={openEdit}
                            onMerge={setMergeSource}
                            onDelete={handleDelete}
                          />
                          {open && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={7} className="p-0">
                                <div data-inline-editor>
                                  <PositionInlineEditor positionId={p.id} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </PageContent>

      <Dialog open={dialog === 'create' || (!!dialog && typeof dialog === 'object' && 'edit' in dialog)} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{dialog === 'create' ? 'Neue Position' : 'Position bearbeiten'}</DialogTitle></DialogHeader>
          <PositionForm value={form} onChange={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Abbrechen</Button>
            <Button onClick={handleSave} disabled={createPosition.isPending || updatePosition.isPending}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PositionMergeDialog
        open={mergeSource !== null}
        onOpenChange={(o) => { if (!o) setMergeSource(null) }}
        source={mergeSource}
      />
    </div>
  )
}
