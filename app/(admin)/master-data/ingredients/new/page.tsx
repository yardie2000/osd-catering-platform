'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { useCreateIngredient } from '@/hooks/use-ingredients'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { IngredientForm, type IngredientFormValues } from '@/components/ingredients/ingredient-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function NewIngredientPage() {
  const router = useRouter()
  const createIngredient = useCreateIngredient()

  async function handleSubmit(values: IngredientFormValues) {
    try {
      const created = await createIngredient.mutateAsync({
        ingredient_code: values.ingredient_code,
        name: values.name,
        category: values.category ?? null,
        default_unit_id: values.default_unit_id ?? null,
        supplier_name: values.supplier_name ?? null,
        allergens: values.allergens,
        notes: values.notes ?? null,
      })
      toast.success('Zutat erstellt')
      router.push(`/master-data/ingredients/${created.id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zutat anlegen"
        description="Neue Zutat mit Allergenen, Kategorie und Lieferantenzuordnung erfassen."
        actions={
          <Button asChild variant="outline">
            <Link href="/master-data/ingredients">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        }
      />

      <div className="px-8 pb-8">
        <Card className="max-w-2xl">
          <CardContent className="p-6">
            <IngredientForm
              onSubmit={handleSubmit}
              onCancel={() => router.push('/master-data/ingredients')}
              loading={createIngredient.isPending}
              submitLabel="Zutat anlegen"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
