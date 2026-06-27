import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supplierArticlesService, type ManualArticleInput } from '@/services/supplier-articles.service'
import { INGREDIENTS_KEY } from '@/hooks/use-ingredients'

export const SUPPLIER_ARTICLES_KEY = ['ingredient-supplier-articles'] as const
export const PREFERRED_SUPPLIERS_KEY = ['preferred-suppliers'] as const
export const SUPPLIER_ASSIGNMENT_KEY = ['supplier-assignment'] as const

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

/** Map ingredient_id -> bevorzugter Lieferanten-Label (für die Zutatenliste). */
export function usePreferredSuppliers() {
  return useQuery({
    queryKey: PREFERRED_SUPPLIERS_KEY,
    queryFn: async () => {
      const rows = await supplierArticlesService.listPreferredSuppliers()
      const map: Record<string, string> = {}
      for (const r of rows) map[r.ingredient_id] = r.label
      return map
    },
    staleTime: 5 * 60 * 1000,
  })
}

/** Alle Zutaten mit Lieferanten-Kandidaten (zentrale Zuordnungs-Übersicht). */
export function useSupplierAssignment() {
  return useQuery({
    queryKey: SUPPLIER_ASSIGNMENT_KEY,
    queryFn: () => supplierArticlesService.listAllCandidates(),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Setzt (oder löscht bei mappingId=null) den bevorzugten Lieferanten einer
 * beliebigen Zutat — für die zentrale Zuordnung über mehrere Zutaten hinweg.
 */
export function useSetPreferredAny() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ingredientId, mappingId }: { ingredientId: string; mappingId: string | null }) =>
      mappingId
        ? supplierArticlesService.setPreferred(ingredientId, mappingId)
        : supplierArticlesService.clearPreferred(ingredientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPPLIER_ASSIGNMENT_KEY })
      queryClient.invalidateQueries({ queryKey: PREFERRED_SUPPLIERS_KEY })
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY })
    },
  })
}

function useEkInvalidate(ingredientId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: [...SUPPLIER_ARTICLES_KEY, ingredientId] })
    queryClient.invalidateQueries({ queryKey: PREFERRED_SUPPLIERS_KEY })
    queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY })
  }
}

export function useAddSupplierArticle(ingredientId: string) {
  const invalidate = useEkInvalidate(ingredientId)
  return useMutation({
    mutationFn: (input: ManualArticleInput) =>
      supplierArticlesService.addManualArticle(ingredientId, input),
    onSuccess: invalidate,
  })
}

export function useSetPreferred(ingredientId: string) {
  const invalidate = useEkInvalidate(ingredientId)
  return useMutation({
    mutationFn: (mappingId: string) =>
      supplierArticlesService.setPreferred(ingredientId, mappingId),
    onSuccess: invalidate,
  })
}

export function useRemoveMapping(ingredientId: string) {
  const invalidate = useEkInvalidate(ingredientId)
  return useMutation({
    mutationFn: (mappingId: string) => supplierArticlesService.removeMapping(mappingId),
    onSuccess: invalidate,
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => supplierArticlesService.createSupplier(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

/**
 * Auto-Zuordnung aller offenen Lieferantenartikel zu Zutaten (Teil 8).
 * Legt fehlende Zutaten an, markiert mehrdeutige Treffer als Review.
 */
export function useAutoAssignSupplierArticles() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => supplierArticlesService.autoAssignUnmapped(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPPLIER_ASSIGNMENT_KEY })
      queryClient.invalidateQueries({ queryKey: PREFERRED_SUPPLIERS_KEY })
      queryClient.invalidateQueries({ queryKey: INGREDIENTS_KEY })
    },
  })
}
