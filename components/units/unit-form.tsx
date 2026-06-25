'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const unitFormSchema = z.object({
  unit_code: z.string().min(1, 'Pflichtfeld'),
  name: z.string().min(1, 'Pflichtfeld'),
  short_name: z.string().optional(),
  base_unit: z.string().optional(),
  conversion_factor: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().positive().optional().nullable(),
  ),
})

export type UnitFormValues = z.infer<typeof unitFormSchema>

interface UnitFormProps {
  defaultValues?: Partial<UnitFormValues>
  onSubmit: (values: UnitFormValues) => void
  onCancel?: () => void
  loading: boolean
  submitLabel?: string
}

export function UnitForm({
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  submitLabel = 'Speichern',
}: UnitFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UnitFormValues>({
    resolver: zodResolver(unitFormSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
