import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supplierArticlesService, type ManualArticleInput } from '@/services/supplier-articles.service'

export const SUPPLIER_ARTICLES_KEY = ['ingredient-supplier-articles'] as const

export function useIngredientSupplierArticles(ingredientId: string) {
  return useQuery({
    queryKey: [...SUPPLIER_ARTICLES_KEY, ingredientId],
    queryFn: () => supplierArticlesService.getByIngredientId(ingredientId),
    enabled: !!ingredientId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierArticlesService.listSuppliers(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useAddSupplierArticle(ingredientId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ManualArticleInput) =>
      supplierArticlesService.addManualArticle(ingredientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SUPPLIER_ARTICLES_KEY, ingredientId] })
    },
  })
}
