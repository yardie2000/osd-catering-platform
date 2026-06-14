'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useIngredientCategories } from '@/hooks/use-ingredients'
import { useUnits } from '@/hooks/use-units'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALLERGENS } from '@/types'

export const ingredientFormSchema = z.object({
  ingredient_code: z.string().min(1, 'Pflichtfeld'),
  name: z.string().min(1, 'Pflichtfeld'),
  category: z.string().optional(),
  default_unit_id: z.string().optional().nullable(),
  supplier_name: z.string().optional(),
  allergens: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export type IngredientFormValues = z.infer<typeof ingredientFormSchema>

interface IngredientFormProps {
  defaultValues?: Partial<IngredientFormValues>
  onSubmit: (values: IngredientFormValues) => void
  onCancel?: () => void
  loading: boolean
  submitLabel?: string
}

export function IngredientForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel = 'Speichern',
}: IngredientFormProps) {
  const { data: units = [] } = useUnits()
  const { data: categories = [] } = useIngredientCategories()
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientFormSchema),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading ? 'Speichern…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
