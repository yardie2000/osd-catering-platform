'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, ChevronUp, ChevronDown, Layers } from 'lucide-react'
import { toast } from 'sonner'

import { getErrorMessage } from '@/lib/errors'
import {
  useMenuPositions, useAddPositionToMenu, useRemoveMenuPosition,
  useSetMenuPositionPrice, useSetMenuPositionAddOn, useReorderMenuPositions,
} from '@/hooks/use-menus'
import { useCreatePosition } from '@/hooks/use-positions'
import { PositionPicker } from '@/components/master-data/positions/position-picker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { PositionListRow } from '@/services/positions.service'

export function MenuPositionsManager({ menuId }: { menuId: string }) {
  const { data: rows = [], isLoading } = useMenuPositions(menuId)
  const addPos = useAddPositionToMenu(menuId)
  const removePos = useRemoveMenuPosition(menuId)
  const setPrice = useSetMenuPositionPrice(menuId)
  const setAddOn = useSetMenuPositionAddOn(menuId)
  const reorder = useReorderMenuPositions(menuId)
  const createPosition = useCreatePosition()

  const [pickerOpen, setPickerOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleAddExisting(p: PositionListRow) {
    setPickerOpen(false)
    try {
      await addPos.mutateAsync({ positionId: p.id, sortOrder: rows.length })
      toast.success(`„${p.name}" hinzugefügt`)
    } catch (e) {
      const m = getErrorMessage(e)
      toast.error(/duplicate|unique/i.test(m) ? 'Position ist bereits in diesem Menü' : m)
    }
  }

  async function handleNew() {
    if (!newName.trim()) { toast.error('Name eingeben'); return }
    try {
      const pos = await createPosition.mutateAsync({ name: newName.trim() })
      await addPos.mutateAsync({ positionId: pos.id, sortOrder: rows.length })
      toast.success('Position angelegt & hinzugefügt — Komponenten im Katalog ergänzen')
      setNewName(''); setNewOpen(false)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleRemove(id: string, name: string) {
    if (!confirm(`„${name}" aus diesem Menü entfernen? (Position bleibt im Katalog erhalten)`)) return
    try { await removePos.mutateAsync(id); toast.success('Aus dem Menü entfernt') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    try { await reorder.mutateAsync(next.map((r, i) => ({ id: r.id, sort_order: i }))) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handlePrice(id: string, value: string, current: number | null) {
    const v = value.trim() === '' ? null : Number(value)
    if (v !== null && !Number.isFinite(v)) return
    if (v === current) return
    try { await setPrice.mutateAsync({ id, price: v }) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleAddOn(id: string, isAddOn: boolean) {
    try { await setAddOn.mutateAsync({ id, isAddOn }) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">Positionen in diesem Menü</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" /> Vorhandene Position
          </Button>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Neue Position
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Ernährung</TableHead>
              <TableHead>Allergene</TableHead>
              <TableHead className="w-20 text-center">Add-on</TableHead>
              <TableHead className="w-28">Preis (€)</TableHead>
              <TableHead className="w-28 text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <div className="space-y-3">
                    <p>Noch keine Positionen. Vorhandene aus dem Katalog hinzufügen oder neu anlegen.</p>
                    <Button size="sm" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4" /> Vorhandene Position</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, i) => {
                const pos = r.position
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground text-sm align-top">{i + 1}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{pos?.name ?? '—'}</p>
                        {r.is_add_on && <Badge variant="secondary" className="text-[10px]">Add-on</Badge>}
                      </div>
                      {pos && (
                        <Link
                          href={`/master-data/positions?component=${encodeURIComponent(pos.id)}`}
                          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Layers className="h-3 w-3" /> Position und Komponenten öffnen
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="align-top text-muted-foreground">{pos?.dietary ?? '—'}</TableCell>
                    <TableCell className="align-top">
                      {pos && pos.allergens.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {pos.allergens.slice(0, 3).map((a) => <Badge key={a} variant="warning" className="text-[10px] px-1.5">{a}</Badge>)}
                          {pos.allergens.length > 3 && <Badge variant="outline" className="text-[10px] px-1.5">+{pos.allergens.length - 3}</Badge>}
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="align-top text-center">
                      <input
                        type="checkbox"
                        checked={r.is_add_on}
                        onChange={(e) => handleAddOn(r.id, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                        aria-label={`„${pos?.name ?? 'Position'}" als Add-on kennzeichnen`}
                        title="Als Add-on in diesem Menü kennzeichnen"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="number" step="0.01"
                        defaultValue={r.price_override ?? ''}
                        placeholder={pos?.default_price != null ? String(pos.default_price) : '—'}
                        onBlur={(e) => handlePrice(r.id, e.target.value, r.price_override)}
                        className="h-8 w-24"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === 0} onClick={() => handleMove(i, -1)} aria-label="Nach oben"><ChevronUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i === rows.length - 1} onClick={() => handleMove(i, 1)} aria-label="Nach unten"><ChevronDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(r.id, pos?.name ?? 'Position')} aria-label="Entfernen"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <PositionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleAddExisting}
        excludeIds={rows.map((r) => r.position_id)}
      />

      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) setNewName('') }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Position anlegen</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Name *</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="z. B. Kartoffelsalat" className="mt-1" autoFocus />
            <p className="text-xs text-muted-foreground mt-1">Wird im Katalog angelegt und diesem Menü hinzugefügt. Komponenten/Allergene danach unter Stammdaten → Positionen ergänzen.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Abbrechen</Button>
            <Button onClick={handleNew} disabled={createPosition.isPending || addPos.isPending}>Anlegen & hinzufügen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
