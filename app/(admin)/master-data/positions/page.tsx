'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Search, Layers, GitMerge } from 'lucide-react'
import { toast } from 'sonner'

import {
  usePositions, usePosition, useCreatePosition, useUpdatePosition, useDeletePosition,
} from '@/hooks/use-positions'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { PositionComponentsDialog } from '@/components/master-data/positions/position-components-dialog'
import { PositionMergeDialog } from '@/components/master-data/positions/position-merge-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ALLERGENS } from '@/types'
import type { PositionListRow } from '@/services/positions.service'

type FormState = { name: string; dietary: string; default_price: string; notes: string; allergens: string[] }
const EMPTY: FormState = { name: '', dietary: '', default_price: '', notes: '', allergens: [] }

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

export default function PositionsPage() {
  const [search, setSearch] = useState('')
  const { data: positions = [], isLoading } = usePositions(search)
  const createPosition = useCreatePosition()
  const updatePosition = useUpdatePosition()
  const deletePosition = useDeletePosition()

  const [dialog, setDialog] = useState<'create' | { edit: PositionListRow } | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [componentsId, setComponentsId] = useState<string | null>(null)
  const { data: componentsPosition } = usePosition(componentsId ?? '')
  const [mergeSource, setMergeSource] = useState<PositionListRow | null>(null)

  function openCreate() { setForm(EMPTY); setDialog('create') }
  function openEdit(p: PositionListRow) {
    setForm({ name: p.name, dietary: p.dietary ?? '', default_price: p.default_price?.toString() ?? '', notes: p.notes ?? '', allergens: p.allergens ?? [] })
    setDialog({ edit: p })
  }

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

  async function handleDelete(p: PositionListRow) {
    if (p.usageCount > 0) { toast.error(`Position wird in ${p.usageCount} Menü(s) verwendet — dort erst entfernen.`); return }
    if (!confirm(`Position „${p.name}" wirklich löschen?`)) return
    try { await deletePosition.mutateAsync(p.id); toast.success('Position gelöscht') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Positionen"
        description="Wiederverwendbarer Positions-Katalog — zentral pflegen, in mehreren Menüs nutzen"
        actions={<Button onClick={openCreate} size="sm"><Plus className="h-4 w-4" /> Neue Position</Button>}
      />
      <div className="p-8 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Positionen nach Name oder Code suchen…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Ernährung</TableHead>
                  <TableHead>Allergene</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead>Komponenten</TableHead>
                  <TableHead>In Menüs</TableHead>
                  <TableHead className="w-28 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
                ) : positions.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Positionen gefunden.</TableCell></TableRow>
                ) : (
                  positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.position_code && <div className="font-mono text-[11px] text-muted-foreground">{p.position_code}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.dietary ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.allergens.length === 0 ? <span className="text-muted-foreground text-xs">Keine</span>
                            : p.allergens.slice(0, 3).map((a) => <Badge key={a} variant="warning" className="text-[10px] px-1.5">{a}</Badge>)}
                          {p.allergens.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5">+{p.allergens.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.default_price != null ? `${p.default_price} €` : '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setComponentsId(p.id)}>
                          <Layers className="h-3.5 w-3.5" /> {p.componentCount}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {p.usageCount > 0 ? <Badge variant="secondary">{p.usageCount}</Badge> : <span className="text-muted-foreground text-xs">0</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Bearbeiten" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" title="Mit anderer Position zusammenführen" onClick={() => setMergeSource(p)}><GitMerge className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" title="Löschen" onClick={() => handleDelete(p)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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

      <PositionComponentsDialog
        open={componentsId !== null}
        onOpenChange={(o) => { if (!o) setComponentsId(null) }}
        position={componentsPosition ?? null}
      />

      <PositionMergeDialog
        open={mergeSource !== null}
        onOpenChange={(o) => { if (!o) setMergeSource(null) }}
        source={mergeSource}
      />
    </div>
  )
}
