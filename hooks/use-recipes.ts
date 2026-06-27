// hooks/use-recipes.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { recipesService } from '@/services/recipes.service'
import type { RecipeInsert, RecipeUpdate } from '@/types'

export const RECIPES_KEY = ['recipes'] as const

export function useRecipes(options?: { search?: string; scalable?: boolean; includeArchived?: boolean }) {
  return useQuery({
    queryKey: [...RECIPES_KEY, options],
    queryFn: () => recipesService.getAll(options),
  })
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: [...RECIPES_KEY, id],
    queryFn: () => recipesService.getById(id),
    enabled: !!id,
  })
}

export function useRecipeAllergens(id: string) {
  return useQuery({
    queryKey: [...RECIPES_KEY, id, 'allergens'],
    queryFn: () => recipesService.getAllergens(id),
    enabled: !!id,
  })
}

export function useCreateRecipe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RecipeInsert) => recipesService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY })
    },
  })
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RecipeUpdate }) =>
      recipesService.update(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY })
      queryClient.invalidateQueries({ queryKey: [...RECIPES_KEY, variables.id] })
    },
  })
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => recipesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY })
    },
  })
}

export function useBackfillBasePortions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => recipesService.backfillBasePortionsFromYield(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECIPES_KEY })
    },
  })
}