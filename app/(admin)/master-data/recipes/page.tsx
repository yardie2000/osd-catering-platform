'use client'

import { Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Search, Scale, Eye } from 'lucide-react'
import { toast } from 'sonner'

import { useRecipes, useDeleteRecipe } from '@/hooks/use-recipes'
import { getErrorMessage } from '@/lib/errors'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Recipe } from '@/types'

function formatNumber(value: number | null | undefined, decimals = 0) {
  if (value == null) return '—'

  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function RecipesInner() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''
  const [search, setSearch] = useState(initialSearch)

  const { data: recipes = [], isLoading } = useRecipes({ search })
  const deleteRecipe = useDeleteRecipe()

  const totalRecipes = recipes.length
  const scalableCount = useMemo(
    () => recipes.filter((recipe) => recipe.scalable).length,
    [recipes]
  )

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Rezept "${name}" wirklich löschen?`)) return

    try {
      await deleteRecipe.mutateAsync(id)
      toast.success('Rezept gelöscht')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  function renderYield(recipe: Recipe) {
    if (recipe.yield_quantity == null) return '—'
    return formatNumber(recipe.yield_quantity, 3)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezepte"
        description="Rezeptstammdaten, Basisportionen, Ertrag und Skalierbarkeit verwalten."
        actions={
          <Button asChild>
            <Link href="/master-data/recipes/new">
              <Plus className="mr-2 h-4 w-4" />
              Neues Rezept
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Rezepte gesamt</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(totalRecipes)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Skalierbar</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(scalableCount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Nicht skalierbar</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatNumber(totalRecipes - scalableCount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nach Rezeptcode oder Name suchen"
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Rezept</TableHead>
                  <TableHead>Basisportionen</TableHead>
                  <TableHead>Ertrag</TableHead>
                  <TableHead>Produktionsverlust</TableHead>
                  <TableHead>Ausbeute</TableHead>
                  <TableHead>Skalierbar</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Laden…
                    </TableCell>
                  </TableRow>
                ) : recipes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Keine Rezepte gefunden. Importiere Daten oder lege ein neues Rezept an.
                    </TableCell>
                  </TableRow>
                ) : (
                  recipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="font-mono text-xs">{recipe.recipe_code}</TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{recipe.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {recipe.description ? recipe.description.slice(0, 72) : '—'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>{formatNumber(recipe.base_portions, 3)}</TableCell>

                      <TableCell>{renderYield(recipe)}</TableCell>

                      <TableCell>
                        {recipe.production_loss_pct != null
                          ? `${formatNumber(recipe.production_loss_pct, 2)} %`
                          : '—'}
                      </TableCell>

                      <TableCell>
                        {recipe.yield_pct != null
                          ? `${formatNumber(recipe.yield_pct, 2)} %`
                          : '—'}
                      </TableCell>

                      <TableCell>
                        {recipe.scalable ? (
                          <Badge variant="default" className="gap-1">
                            <Scale className="h-3 w-3" />
                            Ja
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Nein</Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/master-data/recipes/${recipe.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ansehen
                            </Link>
                          </Button>

                          <Button asChild variant="outline" size="sm">
                            <Link href={`/master-data/recipes/${recipe.id}/edit`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bearbeiten
                            </Link>
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(recipe.id, recipe.name)}
                            disabled={deleteRecipe.isPending}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </Button>
                        </div>
                      </TableCell>
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

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="p-6">Laden…</div>}>
      <RecipesInner />
    </Suspense>
  )
}