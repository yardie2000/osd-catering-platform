'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

import { useIngredient } from '@/hooks/use-ingredients'
import { IngredientSupplierArticles } from '@/components/ingredients/ingredient-supplier-articles'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export default function IngredientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: ingredient, isLoading } = useIngredient(id)

  if (isLoading) {
    return <div className="p-6">Laden…</div>
  }

  if (!ingredient) {
    return <div className="p-6">Zutat nicht gefunden.</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ingredient.name}
        description={`Zutatencode ${ingredient.ingredient_code}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/master-data/ingredients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/master-data/ingredients/${ingredient.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 px-8 pb-8 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Zutatendetails</CardTitle>
          </CardHeader>
          <CardContent>
            <DataRow label="Code" value={ingredient.ingredient_code} />
            <DataRow label="Name" value={ingredient.name} />
            <DataRow label="Kategorie" value={ingredient.category ?? '—'} />
            <DataRow
              label="Standardeinheit"
              value={
                ingredient.default_unit
                  ? `${ingredient.default_unit.name} (${ingredient.default_unit.unit_code})`
                  : '—'
              }
            />
            <DataRow label="Lieferant" value={ingredient.supplier_name ?? '—'} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Allergene & Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Allergene</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {ingredient.allergens.length === 0 ? (
                  <span className="text-muted-foreground">Keine Allergene hinterlegt.</span>
                ) : (
                  ingredient.allergens.map((allergen) => (
                    <Badge key={allergen} variant="warning" className="text-[10px] px-1.5">
                      {allergen}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Hinweise</p>
              <p className="mt-1 whitespace-pre-wrap">{ingredient.notes ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-8 pb-8">
        <IngredientSupplierArticles ingredientId={ingredient.id} />
      </div>
    </div>
  )
}
