'use client'

import { useCreateRecipe } from '@/hooks/use-recipes'
import { RecipeForm } from '@/components/recipes/recipe-form'

export default function NewRecipePage() {
  const createRecipe = useCreateRecipe()

  return (
    <RecipeForm
      mode="create"
      onCreate={(payload) => createRecipe.mutateAsync(payload)}
      onUpdate={async () => {
        throw new Error('Aktualisieren ist im Erstellen-Modus nicht verfügbar')
      }}
    />
  )
}
