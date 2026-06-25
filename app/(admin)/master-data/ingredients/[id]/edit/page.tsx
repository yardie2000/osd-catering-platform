'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { useIngredient, useUpdateIngredient } from '@/hooks/use-ingredients'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { IngredientForm, type IngredientFormValues } from '@/components/ingredients/ingredient-form'
import { IngredientSupplierArticles } from '@/components/ingredients/ingredient-supplier-articles'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function EditIngredientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: ingredient, isLoading } = useIngredient(id)
  const updateIngredient = useUpdateIngredient()

  if (isLoading) {
    return <div className="p-6">Laden…</div>
  }

  if (!ingredient) {
    return <div className="p-6">Zutat nicht gefunden.</div>
  }

  async function handleSubmit(values: IngredientFormValues) {
    try {
      await updateIngredient.mutateAsync({ id, payload: values })
      toast.success('Zutat aktualisiert')
      router.push(`/master-data/ingredients/${id}`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zutat bearbeiten"
        description={`Zutatencode ${ingredient.ingredient_code}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/master-data/ingredients/${ingredient.id}`}>
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
              defaultValues={{
                ingredient_code: ingredient.ingredient_code,
                name:            ingredient.name,
                category:        ingredient.category        ?? undefined,
                default_unit_id: ingredient.default_unit_id ?? undefined,
                supplier_name:   ingredient.supplier_name   ?? undefined,
                allergens:       ingredient.allergens,
                notes:           ingredient.notes           ?? undefined,
              }}
              onSubmit={handleSubmit}
              onCancel={() => router.push(`/master-data/ingredients/${ingredient.id}`)}
              loading={updateIngredient.isPending}
              submitLabel="Änderungen speichern"
            />
          </CardContent>
        </Card>

        <div className="mt-6 max-w-2xl">
          <IngredientSupplierArticles ingredientId={ingredient.id} />
        </div>
      </div>
    </div>
  )
}
