'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useUnits, useCreateUnit, useUpdateUnit, useDeleteUnit } from '@/hooks/use-units'
import { PageHeader } from '@/components/layout/page-header'
import { UnitForm, type UnitFormValues } from '@/components/units/unit-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/state'
import { Plus, Pencil, Trash2, Search, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import type { Unit } from '@/types'

export default function UnitsPage() {
  const [search, setSearch] = useState('')
  const { data: units = [], isLoading, isError, error } = useUnits({ search })
  const createUnit = useCreateUnit()
  const updateUnit = useUpdateUnit()
  const deleteUnit = useDeleteUnit()

  const [dialog, setDialog] = useState<'create' | { edit: Unit } | null>(null)

  const filtered = units

  async function handleCreate(values: UnitFormValues) {
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

  async function handleEdit(id: string, values: UnitFormValues) {
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog('create')} variant="outline" size="sm">
              <Plus className="h-4 w-4" />
              Schnell anlegen
            </Button>
            <Button asChild size="sm">
              <Link href="/master-data/units/new">
                <Plus className="h-4 w-4" />
                Neue Einheit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {isError && <ErrorState error={error} title="Einheiten konnten nicht geladen werden" />}
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
                  <TableHead className="w-28 text-right">Aktionen</TableHead>
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
                        <Link href={`/master-data/units/${unit.id}`} className="hover:underline">
                          <Badge variant="outline">{unit.unit_code}</Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/master-data/units/${unit.id}`} className="hover:underline">
                          {unit.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{unit.short_name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{unit.base_unit ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {unit.conversion_factor != null ? unit.conversion_factor : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" title="Ansehen" aria-label={`${unit.name} ansehen`}>
                            <Link href={`/master-data/units/${unit.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Bearbeiten"
                            aria-label={`${unit.name} bearbeiten`}
                            onClick={() => setDialog({ edit: unit })}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Löschen"
                            aria-label={`${unit.name} löschen`}
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
          <UnitForm onSubmit={handleCreate} onCancel={() => setDialog(null)} loading={createUnit.isPending} />
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
