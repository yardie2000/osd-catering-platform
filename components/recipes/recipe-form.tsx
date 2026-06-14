'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { useIngredients } from '@/hooks/use-ingredients'
import { useUnits } from '@/hooks/use-units'
import { recipesService } from '@/services/recipes.service'
import { getErrorMessage } from '@/lib/errors'
import type {
  RecipeInsert,
  RecipeIngredientInsert,
  RecipeUpdate,
  RecipeWithDetails,
} from '@/types'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ingredientSchema = z.object({
  ingredient_id: z.string().min(1, 'Zutat ist erforderlich'),
  quantity: z.coerce.number().positive('Menge muss größer als 0 sein'),
  unit_id: z.string().min(1, 'Einheit ist erforderlich'),
  supplier: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  package_qty: z.coerce.number().nullable().optional(),
  package_unit: z.string().nullable().optional(),
})

export const recipeSchema = z.object({
  recipe_code: z.string().min(1, 'Rezeptcode ist erforderlich'),
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().nullable().optional(),
  base_portions: z.coerce.number().positive('Basisportionen müssen größer als 0 sein'),
  yield_quantity: z.coerce.number().positive('Ertrag muss größer als 0 sein'),
  yield_unit_id: z.string().min(1, 'Ertragseinheit ist erforderlich'),
  preparation: z.string().nullable().optional(),
  usage_notes: z.string().nullable().optional(),
  production_notes: z.string().nullable().optional(),
  shelf_life: z.string().nullable().optional(),
  scalable: z.boolean().default(true),
  production_loss_pct: z.coerce
    .number()
    .min(0, 'Produktionsverlust darf nicht negativ sein')
    .max(100, 'Produktionsverlust darf maximal 100 sein'),
  yield_pct: z.coerce
    .number()
    .gt(0, 'Ausbeute muss größer als 0 sein')
    .max(100, 'Ausbeute darf maximal 100 sein'),
  ingredients: z.array(ingredientSchema).default([]),
})

export type RecipeFormValues = z.infer<typeof recipeSchema>

type RecipeFormProps = {
  mode: 'create' | 'edit'
  recipe?: RecipeWithDetails
  onCreate: (payload: RecipeInsert) => Promise<{ id: string }>
  onUpdate: (args: { id: string; payload: RecipeUpdate }) => Promise<unknown>
}

function emptyToNull(value?: string | null) {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function RecipeForm({
  mode,
  recipe,
  onCreate,
  onUpdate,
}: RecipeFormProps) {
  const router = useRouter()
  const { data: ingredients = [] } = useIngredients()
  const { data: units = [] } = useUnits()

  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeSchema),
    defaultValues: {
      recipe_code: '',
      name: '',
      description: '',
      base_portions: 50,
      yield_quantity: 50,
      yield_unit_id: '',
      preparation: '',
      usage_notes: '',
      production_notes: '',
      shelf_life: '',
      scalable: true,
      production_loss_pct: 10,
      yield_pct: 80,
      ingredients: [],
    },
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = form

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'ingredients',
  })

  useEffect(() => {
    if (!recipe) return

    const ingredientDefaults = recipe.recipe_ingredients.map((item) => ({
      ingredient_id: item.ingredient_id,
      quantity: item.quantity,
      unit_id: item.unit_id,
      supplier: item.supplier ?? '',
      notes: item.notes ?? '',
      package_qty: item.package_qty ?? null,
      package_unit: item.package_unit ?? '',
    }))

    reset({
      recipe_code: recipe.recipe_code,
      name: recipe.name,
      description: recipe.description ?? '',
      base_portions: recipe.base_portions ?? 50,
      yield_quantity: recipe.yield_quantity ?? 50,
      yield_unit_id: recipe.yield_unit_id ?? '',
      preparation: recipe.preparation ?? '',
      usage_notes: recipe.usage_notes ?? '',
      production_notes: recipe.production_notes ?? '',
      shelf_life: recipe.shelf_life ?? '',
      scalable: recipe.scalable,
      production_loss_pct: recipe.production_loss_pct ?? 10,
      yield_pct: recipe.yield_pct ?? 80,
      ingredients: ingredientDefaults,
    })

    replace(ingredientDefaults)
  }, [recipe, reset, replace])

  async function onSubmit(values: RecipeFormValues) {
    try {
      const payload: RecipeInsert | RecipeUpdate = {
        recipe_code: values.recipe_code.trim(),
        name: values.name.trim(),
        description: emptyToNull(values.description),
        base_portions: values.base_portions,
        yield_quantity: values.yield_quantity,
        yield_unit_id: values.yield_unit_id,
        preparation: emptyToNull(values.preparation),
        usage_notes: emptyToNull(values.usage_notes),
        production_notes: emptyToNull(values.production_notes),
        shelf_life: emptyToNull(values.shelf_life),
        scalable: values.scalable,
        production_loss_pct: values.production_loss_pct,
        yield_pct: values.yield_pct,
      }

      const ingredientRows: Omit<RecipeIngredientInsert, 'recipe_id'>[] =
        values.ingredients.map((item) => ({
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
          unit_id: item.unit_id,
          supplier: emptyToNull(item.supplier),
          notes: emptyToNull(item.notes),
          package_qty: item.package_qty ?? null,
          package_unit: emptyToNull(item.package_unit),
        }))

      if (mode === 'create') {
        const created = await onCreate(payload as RecipeInsert)
        await recipesService.upsertIngredients(created.id, ingredientRows)
        toast.success('Rezept erstellt')
        router.push(`/master-data/recipes/${created.id}`)
        return
      }

      if (!recipe) throw new Error('Rezeptdaten fehlen')

      await onUpdate({ id: recipe.id, payload: payload as RecipeUpdate })
      await recipesService.upsertIngredients(recipe.id, ingredientRows)
      toast.success('Rezept aktualisiert')
      router.push(`/master-data/recipes/${recipe.id}`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const backHref =
    mode === 'edit' && recipe
      ? `/master-data/recipes/${recipe.id}`
      : '/master-data/recipes'

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === 'create' ? 'Neues Rezept' : 'Rezept bearbeiten'}
        description={
          mode === 'create'
            ? 'Rezeptstammdaten, Ertrag, Ausbeute und Zutaten erfassen.'
            : 'Rezeptstammdaten, Ertrag, Ausbeute und Zutaten aktualisieren.'
        }
        actions={
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Rezeptdaten</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipe_code">Rezeptcode</Label>
              <Input id="recipe_code" {...register('recipe_code')} />
              {errors.recipe_code && (
                <p className="text-sm text-red-500">{errors.recipe_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea id="description" rows={3} {...register('description')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base_portions">Basisportionen</Label>
              <Input
                id="base_portions"
                type="number"
                step="0.001"
                {...register('base_portions')}
              />
              {errors.base_portions && (
                <p className="text-sm text-red-500">{errors.base_portions.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="yield_quantity">Ertrag (Menge)</Label>
              <Input
                id="yield_quantity"
                type="number"
                step="0.001"
                {...register('yield_quantity')}
              />
              {errors.yield_quantity && (
                <p className="text-sm text-red-500">{errors.yield_quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Ertragseinheit</Label>
              <Select
                value={watch('yield_unit_id') || ''}
                onValueChange={(value) =>
                  setValue('yield_unit_id', value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Einheit wählen" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.yield_unit_id && (
                <p className="text-sm text-red-500">{errors.yield_unit_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shelf_life">Haltbarkeit</Label>
              <Input id="shelf_life" {...register('shelf_life')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="production_loss_pct">Produktionsverlust (%)</Label>
              <Input
                id="production_loss_pct"
                type="number"
                step="0.01"
                {...register('production_loss_pct')}
              />
              {errors.production_loss_pct && (
                <p className="text-sm text-red-500">
                  {errors.production_loss_pct.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="yield_pct">Ausbeute (%)</Label>
              <Input id="yield_pct" type="number" step="0.01" {...register('yield_pct')} />
              {errors.yield_pct && (
                <p className="text-sm text-red-500">{errors.yield_pct.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-7">
              <input
                id="scalable"
                type="checkbox"
                className="h-4 w-4 rounded border"
                checked={watch('scalable')}
                onChange={(e) => setValue('scalable', e.target.checked)}
              />
              <Label htmlFor="scalable">Rezept ist skalierbar</Label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="preparation">Zubereitung</Label>
              <Textarea id="preparation" rows={5} {...register('preparation')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usage_notes">Verwendungshinweise</Label>
              <Textarea id="usage_notes" rows={4} {...register('usage_notes')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="production_notes">Produktionshinweise</Label>
              <Textarea id="production_notes" rows={4} {...register('production_notes')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Zutaten</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  ingredient_id: '',
                  quantity: 1,
                  unit_id: '',
                  supplier: '',
                  notes: '',
                  package_qty: null,
                  package_unit: '',
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Zutat hinzufügen
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Zutaten. Klicke auf „Zutat hinzufügen“.
              </p>
            ) : (
              fields.map((field, index) => (
                <div key={field.id} className="grid gap-4 rounded-lg border p-4 md:grid-cols-6">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Zutat</Label>
                    <Select
                      value={watch(`ingredients.${index}.ingredient_id`) || ''}
                      onValueChange={(value) =>
                        setValue(`ingredients.${index}.ingredient_id`, value, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Zutat wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {ingredients.map((ingredient) => (
                          <SelectItem key={ingredient.id} value={ingredient.id}>
                            {ingredient.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.ingredients?.[index]?.ingredient_id && (
                      <p className="text-sm text-red-500">
                        {errors.ingredients[index]?.ingredient_id?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Menge</Label>
                    <Input
                      type="number"
                      step="0.001"
                      {...register(`ingredients.${index}.quantity`)}
                    />
                    {errors.ingredients?.[index]?.quantity && (
                      <p className="text-sm text-red-500">
                        {errors.ingredients[index]?.quantity?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Einheit</Label>
                    <Select
                      value={watch(`ingredients.${index}.unit_id`) || ''}
                      onValueChange={(value) =>
                        setValue(`ingredients.${index}.unit_id`, value, {
                          shouldValidate: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Einheit wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.ingredients?.[index]?.unit_id && (
                      <p className="text-sm text-red-500">
                        {errors.ingredients[index]?.unit_id?.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Lieferant</Label>
                    <Input {...register(`ingredients.${index}.supplier`)} />
                  </div>

                  <div className="flex items-end">
                    <Button type="button" variant="destructive" onClick={() => remove(index)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Entfernen
                    </Button>
                  </div>

                  <div className="space-y-2 md:col-span-3">
                    <Label>Notizen</Label>
                    <Input {...register(`ingredients.${index}.notes`)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Packungsmenge</Label>
                    <Input
                      type="number"
                      step="0.001"
                      {...register(`ingredients.${index}.package_qty`)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Packungseinheit</Label>
                    <Input {...register(`ingredients.${index}.package_unit`)} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>Abbrechen</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {mode === 'create' ? 'Rezept speichern' : 'Änderungen speichern'}
          </Button>
        </div>
      </form>
    </div>
  )
}