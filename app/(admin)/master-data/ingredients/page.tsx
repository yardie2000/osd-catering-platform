'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useIngredients, useIngredientCategories, useCreateIngredient, useUpdateIngredient, useDeleteIngredient } from '@/hooks/use-ingredients'
import { PageHeader } from '@/components/layout/page-header'
import { IngredientForm, type IngredientFormValues } from '@/components/ingredients/ingredient-form'
import { IngredientSupplierArticles } from '@/components/ingredients/ingredient-supplier-articles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Search, Filter, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import type { IngredientWithUnit } from '@/types'

export default function IngredientsPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [dialog, setDialog] = useState<'create' | { edit: IngredientWithUnit } | null>(null)

  const { data: ingredients = [], isLoading } = useIngredients({ search, category: categoryFilter === '__all__' ? undefined : categoryFilter })
  const { data: categories = [] } = useIngredientCategories()
  const createIngredient = useCreateIngredient()
  const updateIngredient = useUpdateIngredient()
  const deleteIngredient = useDeleteIngredient()

  async function handleCreate(values: IngredientFormValues) {
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

  async function handleEdit(id: string, values: IngredientFormValues) {
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog('create')} variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Schnell anlegen
            </Button>
            <Button asChild size="sm">
              <Link href="/master-data/ingredients/new">
                <Plus className="h-4 w-4" /> Neue Zutat
              </Link>
            </Button>
          </div>
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
                  <TableHead className="w-28 text-right">Aktionen</TableHead>
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
                      <TableCell>
                        <Link href={`/master-data/ingredients/${ing.id}`} className="hover:underline">
                          <Badge variant="outline">{ing.ingredient_code}</Badge>
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/master-data/ingredients/${ing.id}`} className="hover:underline">
                          {ing.name}
                        </Link>
                      </TableCell>
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
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" title="Ansehen">
                            <Link href={`/master-data/ingredients/${ing.id}`}><Eye className="h-3.5 w-3.5" /></Link>
                          </Button>
                          <Button variant="ghost" size="icon" title="Bearbeiten" onClick={() => setDialog({ edit: ing })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" title="Löschen" onClick={() => handleDelete(ing.id, ing.name)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
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
            <div className="mt-2">
              <IngredientSupplierArticles ingredientId={dialog.edit.id} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
