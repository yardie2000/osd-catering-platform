'use client'

import { useRef, useState } from 'react'
import { Plus, Trash2, Link2, BookOpen, Carrot, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { getErrorMessage } from '@/lib/errors'
import {
  usePosition,
  useAddPositionComponent,
  useRemovePositionComponent,
  useUpdatePositionComponent,
} from '@/hooks/use-positions'
import { useIngredients } from '@/hooks/use-ingredients'
import { useUnits } from '@/hooks/use-units'
import { MenuRecipePicker } from '@/components/master-data/menus/menu-recipe-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Recipe } from '@/types'

const NO_UNIT = '__none__'

/**
 * Inline-Komponenteneditor (Produktionsmodus): wird direkt in der aufgeklappten
 * Positionszeile gerendert — kein Dialog. Unterstützt beliebig viele Rezept- UND
 * Zutat-Komponenten je Position. ENTER fügt die Add-Zeile hinzu; nach dem Hinzufügen
 * bleibt der Fokus im Eingabefeld für schnelles Weiterarbeiten.
 */
export function PositionInlineEditor({ positionId }: { positionId: string }) {
  const { data: position, isLoading } = usePosition(positionId)
  const addComponent = useAddPositionComponent()
  const updateComponent = useUpdatePositionComponent()
  const removeComponent = useRemovePositionComponent()
  const { data: ingredients = [] } = useIngredients()
  const { data: units = [] } = useUnits()

  const [kind, setKind] = useState<'recipe' | 'ingredient'>('ingredient')
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty] = useState('1')
  const [unitId, setUnitId] = useState<string>(NO_UNIT)
  const [pickerOpen, setPickerOpen] = useState(false)
  const ingredientTriggerRef = useRef<HTMLButtonElement>(null)

  const components = position?.components ?? []

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
          position_id: positionId, recipe_id: recipe.id, quantity,
          unit_id: unitId === NO_UNIT ? null : unitId, sort_order: components.length,
        })
      } else {
        if (!ingredientId) { toast.error('Zutat wählen'); return }
        await addComponent.mutateAsync({
          position_id: positionId, ingredient_id: ingredientId, quantity,
          unit_id: unitId === NO_UNIT ? null : unitId, sort_order: components.length,
        })
      }
      resetAdd()
      // Fokus zurück für zügiges Weitererfassen
      if (kind === 'ingredient') ingredientTriggerRef.current?.focus()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleQty(id: string, value: string, current: number) {
    const q = Number(value)
    if (!Number.isFinite(q) || q <= 0 || q === current) return
    try { await updateComponent.mutateAsync({ id, patch: { quantity: q } }) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleUnit(id: string, value: string) {
    try { await updateComponent.mutateAsync({ id, patch: { unit_id: value === NO_UNIT ? null : value } }) }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleRemove(id: string) {
    try { await removeComponent.mutateAsync(id); toast.success('Komponente entfernt') }
    catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Komponenten laden…</div>
  }

  return (
    <div className="space-y-3 bg-muted/30 px-3 py-3">
      {/* bestehende Komponenten */}
      <div className="space-y-1.5">
        {components.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Komponenten — unten Rezept oder Zutat hinzufügen.</p>
        ) : (
          components.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5">
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
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                className="h-8 w-20"
                aria-label="Menge"
              />
              <Select value={c.unit_id ?? NO_UNIT} onValueChange={(v) => handleUnit(c.id, v)}>
                <SelectTrigger className="h-8 w-28 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_UNIT}>{c.recipe_id ? 'Portion' : '—'}</SelectItem>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.short_name || u.name} ({u.unit_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemove(c.id)} aria-label="Entfernen">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Add-Zeile */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-2.5">
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={kind === 'ingredient' ? 'default' : 'outline'} onClick={() => { setKind('ingredient'); resetAdd() }}>
            <Carrot className="h-4 w-4" /> Zutat
          </Button>
          <Button type="button" size="sm" variant={kind === 'recipe' ? 'default' : 'outline'} onClick={() => { setKind('recipe'); resetAdd() }}>
            <BookOpen className="h-4 w-4" /> Rezept
          </Button>
        </div>

        {kind === 'recipe' ? (
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs text-muted-foreground">Rezept (vorproduziert)</label>
            <Button type="button" variant="secondary" className="mt-1 w-full justify-start" onClick={() => setPickerOpen(true)}>
              <Link2 className="h-4 w-4" /> {recipe ? recipe.name : 'Rezept wählen…'}
            </Button>
          </div>
        ) : (
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs text-muted-foreground">Zutat (zugekauft/roh)</label>
            <Select value={ingredientId || undefined} onValueChange={setIngredientId}>
              <SelectTrigger ref={ingredientTriggerRef} className="mt-1"><SelectValue placeholder="Zutat wählen…" /></SelectTrigger>
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
          <Input
            type="number" min={0} step="any" value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            className="mt-1 h-9"
          />
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
          {addComponent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Hinzufügen
        </Button>
      </div>

      <MenuRecipePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(r) => { setRecipe(r); setPickerOpen(false) }}
        selectedRecipeId={recipe?.id ?? null}
        title="Rezept als Komponente wählen"
      />
    </div>
  )
}
