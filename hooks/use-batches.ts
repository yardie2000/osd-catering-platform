import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { batchService } from '@/services/batch.service'
import type { KitchenBatchInsert, KitchenBatchUpdate } from '@/types'

export const BATCHES_KEY = ['batches'] as const

export function useBatches() {
  return useQuery({
    queryKey: BATCHES_KEY,
    queryFn: () => batchService.getAll(),
  })
}

export function useBatch(id: string) {
  return useQuery({
    queryKey: [...BATCHES_KEY, id],
    queryFn: () => batchService.getById(id),
    enabled: !!id,
  })
}

// Derived production + purchasing outputs for a batch (single source of truth).
export function useBatchOutputs(id: string) {
  return useQuery({
    queryKey: [...BATCHES_KEY, id, 'outputs'],
    queryFn: () => batchService.getOutputs(id),
    enabled: !!id,
  })
}

export function useCreateBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: KitchenBatchInsert) => batchService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
  })
}

export function useUpdateBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: KitchenBatchUpdate }) =>
      batchService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
  })
}

export function useDeleteBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => batchService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: BATCHES_KEY }),
  })
}

// ── batch items (menu + pax) ────────────────────────────────

function useInvalidateBatch(batchId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: [...BATCHES_KEY, batchId] })
}

export function useAddBatchItem(batchId: string) {
  const invalidate = useInvalidateBatch(batchId)
  return useMutation({
    mutationFn: ({ menuId, pax }: { menuId: string; pax: number }) =>
      batchService.addItem(batchId, menuId, pax),
    onSuccess: invalidate,
  })
}

export function useUpdateBatchItemPax(batchId: string) {
  const invalidate = useInvalidateBatch(batchId)
  return useMutation({
    mutationFn: ({ itemId, pax }: { itemId: string; pax: number }) =>
      batchService.updateItemPax(itemId, pax),
    onSuccess: invalidate,
  })
}

export function useRemoveBatchItem(batchId: string) {
  const invalidate = useInvalidateBatch(batchId)
  return useMutation({
    mutationFn: (itemId: string) => batchService.removeItem(itemId),
    onSuccess: invalidate,
  })
}
