'use client'

import { useState } from 'react'
import { useIngredients, useIngredientCategories, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '@/hooks/use-ingredients'
import { useUnits } from '@/hooks/use-units'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { IngredientWithUnit } from '@/types'
import { ALLERGENS } from '@/types'

const schema = z.object({
  ingredient_code: z.string().min(1, 'Pflichtfeld'),
  name: z.string().min(1, 'Pflichtfeld'),
  category: z.string().optional(),
  default_unit_id: z.string().optional().nullable(),
  supplier_name: z.string().optional(),
  allergens: z.array(z.string()).default([]),
  notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function IngredientForm({
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
  const { data: units = [] } = useUnits()
  const { data: categories = [] } = useIngredientCategories()
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { allergens: [], ...defaultValues },
  })
  const selectedAllergens = watch('allergens')

  function toggleAllergen(a: string) {
    const current = selectedAllergens ?? []
    if (current.includes(a)) {
      setValue('allergens', current.filter((x) => x !== a))
    } else {
      setValue('allergens', [...current, a])
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Code *</label>
          <Input {...register('ingredient_code')} placeholder="ZUT-001" className="mt-1" />
          {errors.ingredient_code && <p className="text-xs text-destructive mt-1">{errors.ingredient_code.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Kategorie</label>
          <Input {...register('category')} placeholder="z. B. Gemüse" className="mt-1" />
          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.slice(0, 8).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setValue('category', category)}
                  className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input {...register('name')} placeholder="Name der Zutat" className="mt-1" />
        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Standardeinheit</label>
          <Controller
            control={control}
            name="default_unit_id"
            render={({ field }) => (
              <Select value={field.value ?? '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? null : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Einheit wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Keine</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.unit_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p className="text-xs text-muted-foreground mt-1">Die Standardeinheit erscheint hier, wenn die Zutat in Rezepten und im Einkauf verwendet wird.</p>
        </div>
        <div>
          <label className="text-sm font-medium">Bevorzugter Lieferant / Produkt</label>
          <Input {...register('supplier_name')} placeholder="Bevorzugter Lieferant oder Produktreferenz" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Optionaler Standardlieferant oder Produktbezug für den Einkauf dieser Zutat.</p>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Allergene</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => toggleAllergen(a)}
              className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                selectedAllergens?.includes(a)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Notizen</label>
        <Textarea {...register('notes')} placeholder="Zusätzliche Notizen…" className="mt-1" rows={2} />
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

export default function IngredientsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [dialog, setDialog] = useState<'create' | { edit: IngredientWithUnit } | null>(null)

  const { data: ingredients = [], isLoading } = useIngredients({ search, category: categoryFilter === '__all__' ? undefined : categoryFilter })
  const { data: categories = [] } = useIngredientCategories()
  const createIngredient = useCreateIngredient()
  const updateIngredient = useUpdateIngredient()
  const deleteIngredient = useDeleteIngredient()

  async function handleCreate(values: FormValues) {
    try {
      await createIngredient.mutateAsync({
        ingredient_code: values.ingredient_code,
        name: values.name,
        category: values.category ?? null,
        default_unit_id: values.default_unit_id ?? null,
        supplier_name: values.supplier_name ?? null,
        allergens: values.allergens,
        notes: values.notes ?? null,
      })
      toast.success('Zutat erstellt')
      setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleEdit(id: string, values: FormValues) {
    try {
      await updateIngredient.mutateAsync({ id, payload: values })
      toast.success('Zutat aktualisiert')
      setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Zutat „${name}" wirklich löschen?`)) return
    try {
      await deleteIngredient.mutateAsync(id)
      toast.success('Zutat gelöscht')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Zutaten"
        description="Zutatenstammdaten — Allergene, Kategorien, Lieferantenzuordnung"
        actions={
          <Button onClick={() => setDialog('create')} size="sm">
            <Plus className="h-4 w-4" /> Neue Zutat
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zutaten nach Code, Name oder Lieferant suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Alle Kategorien" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Kategorien</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Standardeinheit</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Allergene</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
                ) : ingredients.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Keine Zutaten gefunden.</TableCell></TableRow>
                ) : (
                  ingredients.map((ing) => (
                    <TableRow key={ing.id}>
                      <TableCell><Badge variant="outline">{ing.ingredient_code}</Badge></TableCell>
                      <TableCell className="font-medium">{ing.name}</TableCell>
                      <TableCell className="text-muted-foreground">{ing.category ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ing.default_unit ? `${ing.default_unit.name} (${ing.default_unit.unit_code})` : '—'}
                      </TableCell>
                      <TableCell>
                        {ing.supplier_name ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{ing.supplier_name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5">
                              Lieferant zugeordnet
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Fehlt</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {ing.allergens.length === 0 ? (
                            <span className="text-muted-foreground text-xs">Keine</span>
                          ) : (
                            ing.allergens.slice(0, 3).map((a) => (
                              <Badge key={a} variant="warning" className="text-[10px] px-1.5">{a}</Badge>
                            ))
                          )}
                          {ing.allergens.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5">+{ing.allergens.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDialog({ edit: ing })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(ing.id, ing.name)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Neue Zutat</DialogTitle></DialogHeader>
          <IngredientForm onSubmit={handleCreate} onCancel={() => setDialog(null)} loading={createIngredient.isPending} />
        </DialogContent>
      </Dialog>
      {dialog && typeof dialog === 'object' && 'edit' in dialog && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Zutat bearbeiten</DialogTitle></DialogHeader>
            <IngredientForm
              defaultValues={{
                ingredient_code: dialog.edit.ingredient_code,
                name:            dialog.edit.name,
                category:        dialog.edit.category        ?? undefined,
                default_unit_id: dialog.edit.default_unit_id ?? undefined,
                supplier_name:   dialog.edit.supplier_name   ?? undefined,
                allergens:       dialog.edit.allergens,
                notes:           dialog.edit.notes           ?? undefined,
              }}
              onSubmit={(v) => handleEdit(dialog.edit.id, v)}
              onCancel={() => setDialog(null)}
              loading={updateIngredient.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
