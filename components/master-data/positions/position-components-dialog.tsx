'use client'

import { useState } from 'react'
import { Plus, Trash2, Link2, BookOpen, Carrot } from 'lucide-react'
import { toast } from 'sonner'

import { getErrorMessage } from '@/lib/errors'
import {
  useAddPositionComponent,
  useRemovePositionComponent,
  useUpdatePositionComponent,
} from '@/hooks/use-positions'
import { useIngredients } from '@/hooks/use-ingredients'
import { useUnits } from '@/hooks/use-units'
import { MenuRecipePicker } from '@/components/master-data/menus/menu-recipe-picker'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PositionWithComponents, Recipe } from '@/types'

const NO_UNIT = '__none__'

export function PositionComponentsDialog({
  open,
  onOpenChange,
  position,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  position: PositionWithComponents | null
}) {
  const addComponent = useAddPositionComponent()
  const updateComponent = useUpdatePositionComponent()
  const removeComponent = useRemovePositionComponent()
  const { data: ingredients = [] } = useIngredients()
  const { data: units = [] } = useUnits()

  const [kind, setKind] = useState<'recipe' | 'ingredient'>('recipe')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState('1')
  const [unitId, setUnitId] = useState<string>(NO_UNIT)
  const [pickerOpen, setPickerOpen] = useState(false)

  if (!position) return null
  const components = position.components ?? []

  function resetAdd() {
    setRecipe(null); setIngredientId(''); setQty('1'); setUnitId(NO_UNIT)
  }

  async function handleAdd() {
    const quantity = Number(qty)
    if (!Number.isFinite(quantity) || quantity <= 0) { toast.error('Menge > 0 eingeben'); return }
    try {
      if (kind === 'recipe') {
        if (!recipe) { toast.error('Rezept wählen'); return }
        await addComponent.mutateAsync({
          position_id: position!.id, recipe_id: recipe.id, quantity,
          unit_id: unitId === NO_UNIT ? null : unitId, sort_order: components.length,
        })
      } else {
        if (!ingredientId) { toast.error('Zutat wählen'); return }
        await addComponent.mutateAsync({
          position_id: position!.id, ingredient_id: ingredientId, quantity,
          unit_id: unitId === NO_UNIT ? null : unitId, sort_order: components.length,
        })
      }
      toast.success('Komponente hinzugefügt')
      resetAdd()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleQty(id: string, value: string, current: number) {
    const q = Number(value)
    if (!Number.isFinite(q) || q <= 0 || q === current) return
    try { await updateComponent.mutateAsync({ id, patch: { quantity: q } }) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleRemove(id: string) {
    try { await removeComponent.mutateAsync(id); toast.success('Komponente entfernt') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Komponenten — {position.name}</DialogTitle>
          <DialogDescription>
            Bestandteile dieser Position: zugekaufte/rohe Zutaten + vorproduzierte Rezepte, je Menge pro Portion.
            Änderungen wirken in allen Menüs, die diese Position nutzen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {components.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Noch keine Komponenten.</p>
          ) : (
            components.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                {c.recipe_id ? (
                  <Badge variant="secondary" className="gap-1 shrink-0"><BookOpen className="h-3 w-3" /> Rezept</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 shrink-0"><Carrot className="h-3 w-3" /> Zutat</Badge>
                )}
                <span className="flex-1 min-w-0 truncate text-sm font-medium">
                  {c.recipe?.name ?? c.ingredient?.name ?? '—'}
                  {c.recipe?.recipe_code && <span className="ml-2 font-mono text-xs text-muted-foreground">{c.recipe.recipe_code}</span>}
                </span>
                <Input
                  type="number" min={0} step="any" defaultValue={c.quantity}
                  onBlur={(e) => handleQty(c.id, e.target.value, c.quantity)}
                  className="h-8 w-20"
                />
                <span className="w-16 shrink-0 text-xs text-muted-foreground">
                  {c.unit ? (c.unit.short_name || c.unit.name) : (c.recipe_id ? 'Portion' : '—')}
                </span>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemove(c.id)} aria-label="Entfernen">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={kind === 'recipe' ? 'default' : 'outline'} onClick={() => { setKind('recipe'); resetAdd() }}>
              <BookOpen className="h-4 w-4" /> Rezept
            </Button>
            <Button type="button" size="sm" variant={kind === 'ingredient' ? 'default' : 'outline'} onClick={() => { setKind('ingredient'); resetAdd() }}>
              <Carrot className="h-4 w-4" /> Zutat
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {kind === 'recipe' ? (
              <div className="min-w-[14rem] flex-1">
                <label className="text-xs text-muted-foreground">Rezept (vorproduziert)</label>
                <Button type="button" variant="secondary" className="mt-1 w-full justify-start" onClick={() => setPickerOpen(true)}>
                  <Link2 className="h-4 w-4" /> {recipe ? recipe.name : 'Rezept wählen…'}
                </Button>
              </div>
            ) : (
              <div className="min-w-[14rem] flex-1">
                <label className="text-xs text-muted-foreground">Zutat (zugekauft/roh)</label>
                <Select value={ingredientId || undefined} onValueChange={setIngredientId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Zutat wählen…" /></SelectTrigger>
                  <SelectContent>
                    {ingredients.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name} <span className="text-muted-foreground">({i.ingredient_code})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="w-20">
              <label className="text-xs text-muted-foreground">Menge</label>
              <Input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 h-9" />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground">Einheit</label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_UNIT}>{kind === 'recipe' ? 'Portion' : '—'}</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.short_name || u.name} ({u.unit_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={handleAdd} disabled={addComponent.isPending}>
              <Plus className="h-4 w-4" /> Hinzufügen
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
        </DialogFooter>
      </DialogContent>

      <MenuRecipePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(r) => { setRecipe(r); setPickerOpen(false) }}
        selectedRecipeId={recipe?.id ?? null}
        title="Rezept als Komponente wählen"
      />
    </Dialog>
  )
}
