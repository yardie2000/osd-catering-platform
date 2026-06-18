import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { positionsService } from '@/services/positions.service'
import type { PositionInsert, PositionUpdate, PositionComponentInsert } from '@/types'

export const POSITIONS_KEY = ['positions'] as const

export function usePositions(search?: string) {
  return useQuery({
    queryKey: [...POSITIONS_KEY, { search }],
    queryFn: () => positionsService.getAll(search),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePosition(id: string) {
  return useQuery({
    queryKey: [...POSITIONS_KEY, id],
    queryFn: () => positionsService.getById(id),
    enabled: !!id,
  })
}

export function useCreatePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: PositionInsert) => positionsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useUpdatePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PositionUpdate }) =>
      positionsService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useDeletePosition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positionsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useMergePositions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      positionsService.merge(sourceId, targetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

// ── Komponenten einer Position ────────────────────────────────
export function useAddPositionComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (component: PositionComponentInsert) => positionsService.addComponent(component),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useUpdatePositionComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { quantity?: number; unit_id?: string | null } }) =>
      positionsService.updateComponent(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}

export function useRemovePositionComponent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => positionsService.removeComponent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: POSITIONS_KEY }),
  })
}
