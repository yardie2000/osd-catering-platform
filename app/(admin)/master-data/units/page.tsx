'use client'

import { useState } from 'react'
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit } from '@/hooks/use-units'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Unit } from '@/types'

const schema = z.object({
  unit_code: z.string().min(1, 'Pflichtfeld'),
  name: z.string().min(1, 'Pflichtfeld'),
  short_name: z.string().optional(),
  base_unit: z.string().optional(),
  conversion_factor: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().positive().optional().nullable()),
})
type FormValues = z.infer<typeof schema>

function UnitForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
}: {
  defaultValues?: Partial<FormValues>
  onSubmit: (v: FormValues) => void
  onCancel?: () => void
  loading: boolean
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Einheitencode *</label>
          <Input {...register('unit_code')} placeholder="z. B. kg" className="mt-1" />
          {errors.unit_code && <p className="text-xs text-destructive mt-1">{errors.unit_code.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Kurzname</label>
          <Input {...register('short_name')} placeholder="z. B. kg" className="mt-1" />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input {...register('name')} placeholder="z. B. Kilogramm" className="mt-1" />
        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Basiseinheit</label>
          <Input {...register('base_unit')} placeholder="z. B. g" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Falls diese Einheit abgeleitet ist, den Code der Basiseinheit eintragen.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Umrechnungsfaktor</label>
          <Input {...register('conversion_factor')} type="number" step="any" placeholder="z. B. 1000" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Wie viele dieser Einheit einer Basiseinheit entsprechen.</p>
        </div>
      </div>
      <DialogFooter>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Speichern…' : 'Speichern'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export default function UnitsPage() {
  const [search, setSearch] = useState('')
  const { data: units = [], isLoading } = useUnits({ search })
  const createUnit = useCreateUnit()
  const updateUnit = useUpdateUnit()
  const deleteUnit = useDeleteUnit()

  const [dialog, setDialog] = useState<'create' | { edit: Unit } | null>(null)

  const filtered = units

  async function handleCreate(values: FormValues) {
    try {
      await createUnit.mutateAsync({
        unit_code: values.unit_code,
        name: values.name,
        short_name: values.short_name ?? null,
        base_unit: values.base_unit ?? null,
        conversion_factor: values.conversion_factor ?? null,
      })
      toast.success('Einheit erstellt')
      setDialog(null)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function handleEdit(id: string, values: FormValues) {
    try {
      await updateUnit.mutateAsync({ id, payload: values })
      toast.success('Einheit aktualisiert')
      setDialog(null)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Einheit „${name}" wirklich löschen?`)) return
    try {
      await deleteUnit.mutateAsync(id)
      toast.success('Einheit gelöscht')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Einheiten"
        description="Maßeinheiten für Rezepte, Produktion und Einkauf verwalten"
        actions={
          <Button onClick={() => setDialog('create')} size="sm">
            <Plus className="h-4 w-4" />
            Neue Einheit
          </Button>
        }
      />

      <div className="p-8 space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Einheiten nach Code oder Name suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kurz</TableHead>
                  <TableHead>Basiseinheit</TableHead>
                  <TableHead>Faktor</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Laden…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <div className="space-y-3">
                        <p>{search ? 'Keine Einheiten gefunden.' : 'Noch keine Einheiten. Aus Excel importieren oder neu anlegen.'}</p>
                        {!search && (
                          <Button size="sm" onClick={() => setDialog('create')}>
                            <Plus className="h-4 w-4" /> Einheit anlegen
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell>
                        <Badge variant="outline">{unit.unit_code}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell className="text-muted-foreground">{unit.short_name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{unit.base_unit ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {unit.conversion_factor != null ? unit.conversion_factor : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDialog({ edit: unit })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(unit.id, unit.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Einheit</DialogTitle>
          </DialogHeader>
          <UnitForm onSubmit={handleCreate} loading={createUnit.isPending} />
        </DialogContent>
      </Dialog>

      {dialog && typeof dialog === 'object' && 'edit' in dialog && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Einheit bearbeiten</DialogTitle>
            </DialogHeader>
            <UnitForm
              defaultValues={{
                unit_code:         dialog.edit.unit_code,
                name:              dialog.edit.name,
                short_name:        dialog.edit.short_name        ?? undefined,
                base_unit:         dialog.edit.base_unit         ?? undefined,
                conversion_factor: dialog.edit.conversion_factor ?? undefined,
              }}
              onSubmit={(v) => handleEdit(dialog.edit.id, v)}
              onCancel={() => setDialog(null)}
              loading={updateUnit.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
