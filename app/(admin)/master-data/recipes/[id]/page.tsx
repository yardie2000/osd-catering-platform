'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Pencil, Scale } from 'lucide-react'

import { useRecipe, useRecipeAllergens } from '@/hooks/use-recipes'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState } from '@/components/ui/state'

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (value == null) return '—'
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: recipe, isLoading, isError, error } = useRecipe(id)
  const { data: allergens = [] } = useRecipeAllergens(id)

  if (isLoading) {
    return <div className="p-6">Laden…</div>
  }

  if (isError) {
    return <div className="p-4 sm:p-6 lg:p-8"><ErrorState error={error} title="Rezept konnte nicht geladen werden" /></div>
  }

  if (!recipe) {
    return <div className="p-6">Rezept nicht gefunden.</div>
  }

  const yieldUnitLabel = recipe.yield_unit
    ? recipe.yield_unit.short_name || recipe.yield_unit.name
    : null

  return (
    <div className="flex flex-col">
      <PageHeader
        title={recipe.name}
        description={`Rezeptcode ${recipe.recipe_code}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/master-data/recipes">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/master-data/recipes/${recipe.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-3 lg:p-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Rezeptbasis</CardTitle>
          </CardHeader>
          <CardContent>
            <DataRow label="Basisportionen" value={formatNumber(recipe.base_portions, 3)} />
            <DataRow
              label="Ertrag"
              value={
                recipe.yield_quantity != null
                  ? `${formatNumber(recipe.yield_quantity, 3)}${yieldUnitLabel ? ` ${yieldUnitLabel}` : ''}`
                  : '—'
              }
            />
            <DataRow
              label="Ausbeute"
              value={recipe.yield_pct != null ? `${formatNumber(recipe.yield_pct, 2)} %` : '—'}
            />
            <DataRow
              label="Produktionsverlust"
              value={
                recipe.production_loss_pct != null
                  ? `${formatNumber(recipe.production_loss_pct, 2)} %`
                  : '—'
              }
            />
            <DataRow label="Haltbarkeit" value={recipe.shelf_life ?? '—'} />
            <DataRow
              label="Skalierbar"
              value={
                recipe.scalable ? (
                  <Badge variant="default" className="gap-1">
                    <Scale className="h-3 w-3" />
                    Ja
                  </Badge>
                ) : (
                  <Badge variant="secondary">Nein</Badge>
                )
              }
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Beschreibung & Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Beschreibung</p>
              <p className="mt-1 whitespace-pre-wrap">{recipe.description ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Zubereitung</p>
              <p className="mt-1 whitespace-pre-wrap">{recipe.preparation ?? '—'}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Verwendungshinweise
                </p>
                <p className="mt-1 whitespace-pre-wrap">{recipe.usage_notes ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Produktionshinweise
                </p>
                <p className="mt-1 whitespace-pre-wrap">{recipe.production_notes ?? '—'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Allergene</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {allergens.length === 0 ? (
                  <span className="text-muted-foreground">Keine Allergene aus Zutaten ermittelt.</span>
                ) : (
                  allergens.map((allergen) => (
                    <Badge key={allergen} variant="warning" className="text-[10px] px-1.5">
                      {allergen}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mx-4 mb-6 sm:mx-6 lg:mx-8">
        <CardHeader>
          <CardTitle>Zutaten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zutat</TableHead>
                  <TableHead className="text-right">Menge</TableHead>
                  <TableHead>Einheit</TableHead>
                  <TableHead>Lieferant</TableHead>
                  <TableHead>Notizen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.recipe_ingredients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Keine Zutaten hinterlegt.
                    </TableCell>
                  </TableRow>
                ) : (
                  recipe.recipe_ingredients.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.ingredient?.name ?? '—'}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.quantity, 3)}</TableCell>
                      <TableCell>{item.unit?.short_name || item.unit?.name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.supplier ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.notes ?? '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
