import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ingredientsService } from '@/services/ingredients.service'
import type { IngredientInsert, IngredientUpdate } from '@/types'

export const INGREDIENTS_KEY = ['ingredients'] as const

export function useIngredients(options?: { search?: string; category?: string }) {
  return useQuery({
    queryKey: [...INGREDIENTS_KEY, options],
    queryFn: () => ingredientsService.getAll(options),
    staleTime: 5 * 60 * 1000,
  })
}

export function useIngredient(id: string) {
  return useQuery({
    queryKey: [...INGREDIENTS_KEY, id],
    queryFn: () => ingredientsService.getById(id),
    enabled: !!id,
  })
}

export function useIngredientCategories() {
  return useQuery({
    queryKey: [...INGREDIENTS_KEY, 'categories'],
    queryFn: () => ingredientsService.getCategories(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: IngredientInsert) => ingredientsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY })
    },
  })
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IngredientUpdate }) =>
      ingredientsService.update(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY })
      queryClient.invalidateQueries({ queryKey: [...INGREDIENTS_KEY, variables.id] })
    },
  })
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => ingredientsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY })
    },
  })
}