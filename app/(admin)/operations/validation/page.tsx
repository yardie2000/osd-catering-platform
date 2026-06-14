'use client'

import { useUnits } from '@/hooks/use-units'
import { useIngredients } from '@/hooks/use-ingredients'
import { useRecipes } from '@/hooks/use-recipes'
import { useMenus } from '@/hooks/use-menus'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertTriangle } from 'lucide-react'

interface Check {
  label: string
  description: string
  status: 'pass' | 'warn' | 'loading'
  detail?: string
}

export default function ValidationPage() {
  const { data: units = [], isLoading: lu } = useUnits()
  const { data: ingredients = [], isLoading: li } = useIngredients()
  const { data: recipes = [], isLoading: lr } = useRecipes()
  const { data: menus = [], isLoading: lm } = useMenus()

  const loading = lu || li || lr || lm

  const ingredientsWithNoUnit = ingredients.filter((i) => !i.default_unit_id)
  const ingredientsWithNoCategory = ingredients.filter((i) => !i.category)

  const checks: Check[] = [
    {
      label: 'Units present',
      description: 'At least one unit must exist.',
      status: loading ? 'loading' : units.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${units.length} units`,
    },
    {
      label: 'Ingredients present',
      description: 'At least one ingredient must exist.',
      status: loading ? 'loading' : ingredients.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${ingredients.length} ingredients`,
    },
    {
      label: 'Recipes present',
      description: 'At least one recipe must exist.',
      status: loading ? 'loading' : recipes.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${recipes.length} recipes`,
    },
    {
      label: 'Ingredients have default unit',
      description: 'All ingredients should have a default unit assigned.',
      status: loading ? 'loading' : ingredientsWithNoUnit.length === 0 ? 'pass' : 'warn',
      detail: loading ? undefined : ingredientsWithNoUnit.length === 0
        ? 'All assigned'
        : `${ingredientsWithNoUnit.length} without unit`,
    },
    {
      label: 'Ingredients have category',
      description: 'Ingredients without a category reduce filter accuracy.',
      status: loading ? 'loading' : ingredientsWithNoCategory.length === 0 ? 'pass' : 'warn',
      detail: loading ? undefined : ingredientsWithNoCategory.length === 0
        ? 'All categorized'
        : `${ingredientsWithNoCategory.length} without category`,
    },
    {
      label: 'Menus present',
      description: 'At least one menu should exist for event planning.',
      status: loading ? 'loading' : menus.length > 0 ? 'pass' : 'warn',
      detail: loading ? undefined : `${menus.length} menus`,
    },
  ]

  const passCount = checks.filter((c) => c.status === 'pass').length
  const warnCount = checks.filter((c) => c.status === 'warn').length

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Data Validation"
        description="Automated checks on master data completeness and consistency"
      />
      <div className="p-8 space-y-6">
        <div className="grid gap-4 grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-3xl font-bold text-emerald-400">{passCount}</p>
              <p className="text-sm text-muted-foreground">Checks passed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-3xl font-bold text-amber-400">{warnCount}</p>
              <p className="text-sm text-muted-foreground">Warnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-3xl font-bold">{checks.length}</p>
              <p className="text-sm text-muted-foreground">Total checks</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Validation Results</CardTitle></CardHeader>
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
