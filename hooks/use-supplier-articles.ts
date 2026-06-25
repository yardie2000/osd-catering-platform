import { useQuery } from '@tanstack/react-query'
import { supplierArticlesService } from '@/services/supplier-articles.service'

export const SUPPLIER_ARTICLES_KEY = ['ingredient-supplier-articles'] as const

export function useIngredientSupplierArticles(ingredientId: string) {
  return useQuery({
    queryKey: [...SUPPLIER_ARTICLES_KEY, ingredientId],
    queryFn: () => supplierArticlesService.getByIngredientId(ingredientId),
    enabled: !!ingredientId,
    staleTime: 5 * 60 * 1000,
  })
}
