'use client'

import { useUnits } from '@/hooks/use-units'
import { useIngredients } from '@/hooks/use-ingredients'
import { useRecipes } from '@/hooks/use-recipes'
import { useMenus } from '@/hooks/use-menus'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/ui/state'
import { CheckCircle, AlertTriangle } from 'lucide-react'

interface Check {
  label: string
  description: string
  status: 'pass' | 'warn' | 'loading'
  detail?: string
}

export default function ValidationPage() {
  const { data: units = [], isLoading: lu, isError: unitsError, error: unitsErrorValue } = useUnits()
  const { data: ingredients = [], isLoading: li, isError: ingredientsError, error: ingredientsErrorValue } = useIngredients()
  const { data: recipes = [], isLoading: lr, isError: recipesError, error: recipesErrorValue } = useRecipes()
  const { data: menus = [], isLoading: lm, isError: menusError, error: menusErrorValue } = useMenus()

  const loading = lu || li || lr || lm

  const ingredientsWithNoUnit = ingredients.filter((i) => !i.default_unit_id)
  const ingredientsWithNoCategory = ingredients.filter((i) => !i.category)

  const checks: Check[] = [
    {
      label: 'Einheiten vorhanden',
      description: 'Mindestens eine Einheit muss vorhanden sein.',
      status: loading ? 'loading' : units.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${units.length} Einheiten`,
    },
    {
      label: 'Zutaten vorhanden',
      description: 'Mindestens eine Zutat muss vorhanden sein.',
      status: loading ? 'loading' : ingredients.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${ingredients.length} Zutaten`,
    },
    {
      label: 'Rezepte vorhanden',
      description: 'Mindestens ein Rezept muss vorhanden sein.',
      status: loading ? 'loading' : recipes.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${recipes.length} Rezepte`,
    },
    {
      label: 'Zutaten mit Standardeinheit',
      description: 'Alle Zutaten sollten eine Standardeinheit zugeordnet haben.',
      status: loading ? 'loading' : ingredientsWithNoUnit.length === 0 ? 'pass' : 'warn',
      detail: loading ? undefined : ingredientsWithNoUnit.length === 0
        ? 'Alle zugeordnet'
        : `${ingredientsWithNoUnit.length} ohne Einheit`,
    },
    {
      label: 'Zutaten mit Kategorie',
      description: 'Zutaten ohne Kategorie verringern die Filtergenauigkeit.',
      status: loading ? 'loading' : ingredientsWithNoCategory.length === 0 ? 'pass' : 'warn',
      detail: loading ? undefined : ingredientsWithNoCategory.length === 0
        ? 'Alle kategorisiert'
        : `${ingredientsWithNoCategory.length} ohne Kategorie`,
    },
    {
      label: 'Menüs vorhanden',
      description: 'Für die Eventplanung sollte mindestens ein Menü vorhanden sein.',
      status: loading ? 'loading' : menus.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${menus.length} Menüs`,
    },
  ]

  const passCount = checks.filter((c) => c.status === 'pass').length
  const warnCount = checks.filter((c) => c.status === 'warn').length

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Datenvalidierung"
        description="Automatische Prüfungen auf Vollständigkeit und Konsistenz der Stammdaten"
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {(unitsError || ingredientsError || recipesError || menusError) && (
          <div className="grid gap-3">
            {unitsError && <ErrorState error={unitsErrorValue} title="Einheiten konnten nicht geladen werden" />}
            {ingredientsError && <ErrorState error={ingredientsErrorValue} title="Zutaten konnten nicht geladen werden" />}
            {recipesError && <ErrorState error={recipesErrorValue} title="Rezepte konnten nicht geladen werden" />}
            {menusError && <ErrorState error={menusErrorValue} title="Menüs konnten nicht geladen werden" />}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-3xl font-bold text-emerald-400">{passCount}</p>
              <p className="text-sm text-muted-foreground">Prüfungen bestanden</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-3xl font-bold text-amber-400">{warnCount}</p>
              <p className="text-sm text-muted-foreground">Warnungen</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-3xl font-bold">{checks.length}</p>
              <p className="text-sm text-muted-foreground">Prüfungen gesamt</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Prüfergebnisse</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {checks.map((check) => (
              <div key={check.label} className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                {check.status === 'loading' ? (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin shrink-0 mt-0.5" />
                ) : check.status === 'pass' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{check.label}</p>
                    {check.detail && (
                      <Badge variant={check.status === 'pass' ? 'success' : 'warning'} className="text-[10px]">
                        {check.detail}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{check.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
