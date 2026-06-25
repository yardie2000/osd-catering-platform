'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useMenus } from '@/hooks/use-menus'
import { useBatch, useAddBatchItem, useUpdateBatchItemPax, useRemoveBatchItem } from '@/hooks/use-batches'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/ui/state'
import { ArrowLeft, Plus, Trash2, ChefHat, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'

const STATUS_LABELS: Record<string, string> = {
  planned: 'Geplant',
  in_progress: 'In Bearbeitung',
  done: 'Abgeschlossen',
  archived: 'Archiviert',
}
const statusLabel = (s: string) => STATUS_LABELS[s] ?? s

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: batch, isLoading, isError, error } = useBatch(id)
  const { data: menus = [] } = useMenus()
  const addItem = useAddBatchItem(id)
  const updatePax = useUpdateBatchItemPax(id)
  const removeItem = useRemoveBatchItem(id)

  const [newMenu, setNewMenu] = useState('')
  const [newPax, setNewPax] = useState('')

  async function handleAdd() {
    if (!newMenu) { toast.error('Menü wählen'); return }
    const pax = Number(newPax)
    if (!Number.isFinite(pax) || pax <= 0) { toast.error('Personenzahl > 0 eingeben'); return }
    try {
      await addItem.mutateAsync({ menuId: newMenu, pax })
      toast.success('Menü hinzugefügt')
      setNewMenu(''); setNewPax('')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }
  async function handlePax(itemId: string, value: string, current: number) {
    const pax = Number(value)
    if (!Number.isFinite(pax) || pax < 0 || pax === current) return
    try { await updatePax.mutateAsync({ itemId, pax }) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }
  async function handleRemove(itemId: string, name: string) {
    if (!confirm(`„${name}" aus dem Produktionslauf entfernen?`)) return
    try { await removeItem.mutateAsync(itemId); toast.success('Entfernt') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Laden…</div>
  if (isError) return <div className="p-4 sm:p-6 lg:p-8"><ErrorState error={error} title="Produktionslauf konnte nicht geladen werden" /></div>
  if (!batch) return <div className="flex items-center justify-center h-full text-muted-foreground">Produktionslauf nicht gefunden.</div>

  const items = batch.kitchen_batch_items ?? []
  const totalPax = items.reduce((s, it) => s + (it.pax_count || 0), 0)

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={batch.name}
        description={`${items.length} Menü(s) · ${totalPax} Personen gesamt`}
        actions={
          <div className="flex gap-2">
            <Link href="/operations/batches"><Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Zurück</Button></Link>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/operations/production?batch=${batch.id}`}><ChefHat className="h-4 w-4" /> Produktionsausgabe</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/operations/purchasing?batch=${batch.id}`}><ShoppingCart className="h-4 w-4" /> Einkaufsausgabe</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{statusLabel(batch.status)}</Badge>
          {batch.production_date && <Badge variant="secondary">Produktion: {new Date(batch.production_date).toLocaleDateString('de-DE')}</Badge>}
          {(batch.start_date || batch.end_date) && (
            <Badge variant="outline">
              {batch.start_date ? new Date(batch.start_date).toLocaleDateString('de-DE') : '…'} – {batch.end_date ? new Date(batch.end_date).toLocaleDateString('de-DE') : '…'}
            </Badge>
          )}
        </div>
        {batch.description && (
          <Card><CardContent className="py-4 text-sm text-muted-foreground">{batch.description}</CardContent></Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm">Menüs &amp; Personenzahl (einmalige Eingabe)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* add row */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[16rem] flex-1">
                <label className="text-xs text-muted-foreground">Menü</label>
                <Select value={newMenu || undefined} onValueChange={setNewMenu}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Menü wählen…" /></SelectTrigger>
                  <SelectContent>
                    {menus.map((m) => <SelectItem key={m.id} value={m.id}>{m.menu_name} · {m.menu_code}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <label className="text-xs text-muted-foreground">Personen</label>
                <Input type="number" min={1} step={1} inputMode="numeric" placeholder="z. B. 250"
                  value={newPax} onChange={(e) => setNewPax(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleAdd} disabled={addItem.isPending}><Plus className="h-4 w-4" /> Hinzufügen</Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Menü</TableHead>
                  <TableHead className="w-40">Personen</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Noch keine Menüs zugeordnet.</TableCell></TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">
                        {it.menu?.menu_name ?? '—'}
                        {it.menu?.menu_code && <span className="block text-xs text-muted-foreground font-mono">{it.menu.menu_code}</span>}
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={0} step={1} defaultValue={it.pax_count}
                          onBlur={(e) => handlePax(it.id, e.target.value, it.pax_count)} className="h-8 w-28" />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(it.id, it.menu?.menu_name ?? 'Menü')} aria-label={`${it.menu?.menu_name ?? 'Menü'} entfernen`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground">
              Diese Eingabe erfolgt genau einmal. Produktions- und Einkaufsausgabe werden automatisch
              aus diesen Menüs + Personenzahl berechnet (gemeinsame Datenbasis).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
