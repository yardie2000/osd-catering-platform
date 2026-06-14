'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { useCreateUnit } from '@/hooks/use-units'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { UnitForm, type UnitFormValues } from '@/components/units/unit-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NewUnitPage() {
  const router = useRouter()
  const createUnit = useCreateUnit()

  async function handleSubmit(values: UnitFormValues) {
    try {
      const created = await createUnit.mutateAsync({
        unit_code: values.unit_code,
        name: values.name,
        short_name: values.short_name ?? null,
        base_unit: values.base_unit ?? null,
        conversion_factor: values.conversion_factor ?? null,
      })
      toast.success('Einheit erstellt')
      router.push(`/master-data/units/${created.id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einheit anlegen"
        description="Neue Maßeinheit mit Kürzel, Basiseinheit und Umrechnungsfaktor erfassen."
        actions={
          <Button asChild variant="outline">
            <Link href="/master-data/units">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        }
      />

      <div className="px-8 pb-8">
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <UnitForm
              onSubmit={handleSubmit}
              onCancel={() => router.push('/master-data/units')}
              loading={createUnit.isPending}
              submitLabel="Einheit anlegen"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
