'use client'

import { useParams } from 'next/navigation'

import { useRecipe, useUpdateRecipe } from '@/hooks/use-recipes'
import { RecipeForm } from '@/components/recipes/recipe-form'
import { ErrorState } from '@/components/ui/state'

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>()
  const { data: recipe, isLoading, isError, error } = useRecipe(id)
  const updateRecipe = useUpdateRecipe()

  if (isLoading) {
    return <div className="p-6">Laden…</div>
  }

  if (isError) {
    return <div className="p-4 sm:p-6 lg:p-8"><ErrorState error={error} title="Rezept konnte nicht geladen werden" /></div>
  }

  if (!recipe) {
    return <div className="p-6">Rezept nicht gefunden.</div>
  }

  return (
    <RecipeForm
      mode="edit"
      recipe={recipe}
      onCreate={async () => {
        throw new Error('Erstellen ist im Bearbeiten-Modus nicht verfügbar')
      }}
      onUpdate={(args) => updateRecipe.mutateAsync(args)}
    />
  )
}
