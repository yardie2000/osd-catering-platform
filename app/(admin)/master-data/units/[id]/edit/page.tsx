'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { useUnit, useUpdateUnit } from '@/hooks/use-units'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { UnitForm, type UnitFormValues } from '@/components/units/unit-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/state'

export default function EditUnitPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: unit, isLoading, isError, error } = useUnit(id)
  const updateUnit = useUpdateUnit()

  if (isLoading) {
    return <div className="p-6">Laden…</div>
  }

  if (isError) {
    return <div className="p-4 sm:p-6 lg:p-8"><ErrorState error={error} title="Einheit konnte nicht geladen werden" /></div>
  }

  if (!unit) {
    return <div className="p-6">Einheit nicht gefunden.</div>
  }

  async function handleSubmit(values: UnitFormValues) {
    try {
      await updateUnit.mutateAsync({ id, payload: values })
      toast.success('Einheit aktualisiert')
      router.push(`/master-data/units/${id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einheit bearbeiten"
        description={`Einheitencode ${unit.unit_code}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/master-data/units/${unit.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        }
      />

      <div className="px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8">
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <UnitForm
              defaultValues={{
                unit_code:         unit.unit_code,
                name:              unit.name,
                short_name:        unit.short_name        ?? undefined,
                base_unit:         unit.base_unit         ?? undefined,
                conversion_factor: unit.conversion_factor ?? undefined,
              }}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/master-data/units/${unit.id}`)}
              loading={updateUnit.isPending}
              submitLabel="Änderungen speichern"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
