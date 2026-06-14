'use client'

import { useParams } from 'next/navigation'

import { useRecipe, useUpdateRecipe } from '@/hooks/use-recipes'
import { RecipeForm } from '@/components/recipes/recipe-form'

export default function EditRecipePage() {
  const { id } = useParams<{ id: string }>()
  const { data: recipe, isLoading } = useRecipe(id)
  const updateRecipe = useUpdateRecipe()

  if (isLoading) {
    return <div className="p-6">Laden…</div>
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
