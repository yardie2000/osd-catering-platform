import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { unitsService } from '@/services/units.service'
import type { UnitInsert, UnitUpdate } from '@/types'

export const UNITS_KEY = ['units'] as const

export function useUnits(options?: { search?: string; base_unit?: string }) {
  return useQuery({
    queryKey: [...UNITS_KEY, options],
    queryFn: () => unitsService.getAll(options),
    staleTime: 5 * 60 * 1000,
  })
}

export function useUnit(id: string) {
  return useQuery({
    queryKey: [...UNITS_KEY, id],
    queryFn: () => unitsService.getById(id),
    enabled: !!id,
  })
}

export function useUnitBaseUnits() {
  return useQuery({
    queryKey: [...UNITS_KEY, 'base-units'],
    queryFn: () => unitsService.getBaseUnits(),
    staleTime: 10 * 60 * 1000,
  })
}

export function useCreateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UnitInsert) => unitsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNITS_KEY })
    },
  })
}

export function useUpdateUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UnitUpdate }) =>
      unitsService.update(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: UNITS_KEY })
      queryClient.invalidateQueries({ queryKey: [...UNITS_KEY, variables.id] })
    },
  })
}

export function useDeleteUnit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => unitsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: UNITS_KEY })
    },
  })
}