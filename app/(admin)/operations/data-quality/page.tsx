'use client'

import Link from 'next/link'
import { Pencil, Wrench } from 'lucide-react'
import { toast } from 'sonner'

import { useIngredients } from '@/hooks/use-ingredients'
import { useRecipes, useBackfillBasePortions } from '@/hooks/use-recipes'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Recipe } from '@/types'

function baseStatus(recipe: Recipe): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  if (recipe.base_portions == null || recipe.base_portions <= 0) missing.push('Basisportionen')
  if (recipe.yield_quantity == null || recipe.yield_quantity <= 0) missing.push('Ertrag')
  if (!recipe.yield_unit_id) missing.push('Ertragseinheit')
  return { complete: missing.length === 0, missing }
}

export default function DataQualityPage() {
  const { data: ingredients = [], isLoading: li } = useIngredients()
  const { data: recipes = [], isLoading: lr } = useRecipes()
  const backfill = useBackfillBasePortions()

  const noAllergenIngredients = ingredients.filter((i) => i.allergens.length === 0)
  const noSupplierIngredients = ingredients.filter((i) => !i.supplier_name)
  const nonScalableRecipes = recipes.filter((r) => !r.scalable)
  const noShelfLifeRecipes = recipes.filter((r) => !r.shelf_life)

  const incompleteBaseRecipes = recipes.filter((r) => !baseStatus(r).complete)
  const completeBaseCount = recipes.length - incompleteBaseRecipes.length
  // Backfillable: no base_portions yet, but a usable yield_quantity to derive it from.
  const backfillableRecipes = recipes.filter(
    (r) => r.base_portions == null && r.yield_quantity != null && r.yield_quantity > 0
  )

  const categories = [...new Set(ingredients.map((i) => i.category).filter(Boolean) as string[])].sort()
  const categoryDistribution = categories.map((cat) => ({
    name: cat,
    count: ingredients.filter((i) => i.category === cat).length,
  }))

  async function handleBackfill() {
    if (backfillableRecipes.length === 0) return
    if (
      !confirm(
        `Bei ${backfillableRecipes.length} Rezept(en) ohne Basisportionen den Ertrag (yield_quantity) als Basisportionen übernehmen?`
      )
    ) {
      return
    }
    try {
      const updated = await backfill.mutateAsync()
      toast.success(`${updated} Rezept(e) aktualisiert`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Datenqualität"
        description="Vollständigkeit und Qualität der Stammdaten"
      />
      <div className="p-8 space-y-6">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Rezepte mit unvollständiger Basis</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-400">{incompleteBaseRecipes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {completeBaseCount} von {recipes.length} vollständig
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Zutaten ohne Allergene</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-400">{noAllergenIngredients.length}</p>
              <p className="text-xs text-muted-foreground mt-1">von {ingredients.length} gesamt</p>
              {noAllergenIngredients.slice(0, 5).map((i) => (
                <p key={i.id} className="text-xs text-muted-foreground mt-0.5">• {i.name}</p>
              ))}
              {noAllergenIngredients.length > 5 && (
                <p className="text-xs text-muted-foreground mt-0.5">…und {noAllergenIngredients.length - 5} weitere</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Zutaten ohne Lieferant</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-400">{noSupplierIngredients.length}</p>
              <p className="text-xs text-muted-foreground mt-1">von {ingredients.length} gesamt</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Nicht skalierbare Rezepte</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{nonScalableRecipes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">von {recipes.length} gesamt</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Rezepte ohne Haltbarkeit</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-400">{noShelfLifeRecipes.length}</p>
              <p className="text-xs text-muted-foreground mt-1">von {recipes.length} gesamt</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm">Rezeptbasis-Vollständigkeit</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Pflichtbasis: Basisportionen, Ertrag und Ertragseinheit
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBackfill}
              disabled={backfillableRecipes.length === 0 || backfill.isPending}
            >
              <Wrench className="mr-2 h-4 w-4" />
              {backfill.isPending
                ? 'Übernehme…'
                : `Basisportionen aus Ertrag übernehmen (${backfillableRecipes.length})`}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Rezept</TableHead>
                  <TableHead>Fehlt</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lr ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Laden…</TableCell></TableRow>
                ) : incompleteBaseRecipes.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground">Alle Rezepte haben eine vollständige Basis.</TableCell></TableRow>
                ) : (
                  incompleteBaseRecipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-mono text-xs">{recipe.recipe_code}</TableCell>
                      <TableCell className="font-medium">{recipe.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {baseStatus(recipe).missing.map((field) => (
                            <Badge key={field} variant="warning" className="text-[10px] px-1.5">{field}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/master-data/recipes/${recipe.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Verteilung der Zutatenkategorien</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Anzahl</TableHead>
                  <TableHead>Anteil</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {li ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Laden…</TableCell></TableRow>
                ) : categoryDistribution.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Keine Kategorien gefunden.</TableCell></TableRow>
                ) : (
                  categoryDistribution.map(({ name, count }) => (
                    <TableRow key={name}>
                      <TableCell>{name}</TableCell>
                      <TableCell>{count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-32 bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${(count / ingredients.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {((count / ingredients.length) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
