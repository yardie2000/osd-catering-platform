'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBatches, useCreateBatch, useUpdateBatch, useDeleteBatch } from '@/hooks/use-batches'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { KitchenBatch } from '@/types'

const STATUS = ['planned', 'in_progress', 'done', 'archived'] as const
const statusVariant = (s: string) =>
  s === 'done' ? 'success' : s === 'in_progress' ? 'warning' : s === 'archived' ? 'secondary' : 'outline'

const schema = z.object({
  name:            z.string().min(1, 'Required'),
  status:          z.string().default('planned'),
  description:     z.string().optional().nullable(),
  start_date:      z.string().optional().nullable(),
  end_date:        z.string().optional().nullable(),
  production_date: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

function BatchForm({ defaultValues, onSubmit, onCancel, loading }: {
  defaultValues?: Partial<FormValues>
  onSubmit: (v: FormValues) => void
  onCancel: () => void
  loading: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'planned', ...defaultValues },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input {...register('name')} placeholder="z. B. Weekend Production · KW23" className="mt-1" />
        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">Start</label>
          <Input type="date" {...register('start_date')} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Ende</label>
          <Input type="date" {...register('end_date')} className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Produktionsdatum</label>
          <Input type="date" {...register('production_date')} className="mt-1" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Status</label>
        <select {...register('status')} className="mt-1 block w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
          {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium">Beschreibung</label>
        <Textarea {...register('description')} rows={2} placeholder="Optional" className="mt-1" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Abbrechen</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Speichern…' : 'Speichern'}</Button>
      </DialogFooter>
    </form>
  )
}

export default function BatchesPage() {
  const { data: batches = [], isLoading } = useBatches()
  const createBatch = useCreateBatch()
  const updateBatch = useUpdateBatch()
  const deleteBatch = useDeleteBatch()
  const [dialog, setDialog] = useState<'create' | { edit: KitchenBatch } | null>(null)

  function toPayload(v: FormValues) {
    return {
      name:            v.name,
      status:          v.status,
      description:     v.description?.trim() || null,
      start_date:      v.start_date || null,
      end_date:        v.end_date || null,
      production_date: v.production_date || null,
    }
  }

  async function handleCreate(v: FormValues) {
    try {
      await createBatch.mutateAsync(toPayload(v))
      toast.success('Batch angelegt'); setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }
  async function handleEdit(id: string, v: FormValues) {
    try {
      await updateBatch.mutateAsync({ id, payload: toPayload(v) })
      toast.success('Batch aktualisiert'); setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Batch „${name}" löschen? Die Menü-Zuordnungen werden mitgelöscht.`)) return
    try { await deleteBatch.mutateAsync(id); toast.success('Batch gelöscht') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Production Batches"
        description="Zentrale Produktionsplanung — Menüs + Pax einmalig erfassen; Produktion & Einkauf werden daraus abgeleitet"
        actions={<Button size="sm" onClick={() => setDialog('create')}><Plus className="h-4 w-4" /> Neuer Batch</Button>}
      />
      <div className="p-8">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Produktionsdatum</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28 text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <div className="space-y-3">
                        <p>Noch keine Production Batches. Lege den ersten an, um Menüs &amp; Pax zu erfassen.</p>
                        <Button size="sm" onClick={() => setDialog('create')}><Plus className="h-4 w-4" /> Batch anlegen</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        <Link href={`/operations/batches/${b.id}`} className="text-primary hover:underline">{b.name}</Link>
                        {b.description && <span className="block text-xs text-muted-foreground">{b.description}</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {b.production_date ? new Date(b.production_date).toLocaleDateString('de-DE') : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {b.start_date || b.end_date
                          ? `${b.start_date ? new Date(b.start_date).toLocaleDateString('de-DE') : '…'} – ${b.end_date ? new Date(b.end_date).toLocaleDateString('de-DE') : '…'}`
                          : '—'}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(b.status)}>{b.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                            <Link href={`/operations/batches/${b.id}`} aria-label="Öffnen"><Eye className="h-4 w-4" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialog({ edit: b })} aria-label="Bearbeiten">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(b.id, b.name)} aria-label="Löschen">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      <Dialog open={dialog === 'create'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>Neuer Production Batch</DialogTitle></DialogHeader>
          <BatchForm onSubmit={handleCreate} onCancel={() => setDialog(null)} loading={createBatch.isPending} />
        </DialogContent>
      </Dialog>
      {dialog && typeof dialog === 'object' && 'edit' in dialog && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent><DialogHeader><DialogTitle>Batch bearbeiten</DialogTitle></DialogHeader>
            <BatchForm
              defaultValues={{
                name:            dialog.edit.name,
                status:          dialog.edit.status,
                description:     dialog.edit.description ?? undefined,
                start_date:      dialog.edit.start_date ?? undefined,
                end_date:        dialog.edit.end_date ?? undefined,
                production_date: dialog.edit.production_date ?? undefined,
              }}
              onSubmit={(v) => handleEdit(dialog.edit.id, v)}
              onCancel={() => setDialog(null)}
              loading={updateBatch.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
