import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menusService } from '@/services/menus.service'
import { POSITIONS_KEY } from '@/hooks/use-positions'
import type { MenuInsert, MenuUpdate } from '@/types'

export const MENUS_KEY = ['menus'] as const

export function useMenus(options?: { active?: boolean; search?: string; category?: string }) {
  return useQuery({
    queryKey: [...MENUS_KEY, options],
    queryFn: () => menusService.getAll(options),
  })
}

export function useMenu(id: string) {
  return useQuery({
    queryKey: [...MENUS_KEY, id],
    queryFn: () => menusService.getById(id),
    enabled: !!id,
  })
}

export function useMenuCategories() {
  return useQuery({
    queryKey: [...MENUS_KEY, 'categories'],
    queryFn: () => menusService.getCategories(),
  })
}

export function useCreateMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: MenuInsert) => menusService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: MENUS_KEY }),
  })
}

export function useUpdateMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: MenuUpdate }) =>
      menusService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: MENUS_KEY }),
  })
}

export function useDeleteMenu() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menusService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: MENUS_KEY }),
  })
}

// ── menu_positions (Position ↔ Menü, V5 Katalog) ─────────────
export function useMenuPositions(menuId: string) {
  return useQuery({
    queryKey: [...MENUS_KEY, menuId, 'positions'],
    queryFn: () => menusService.getMenuPositions(menuId),
    enabled: !!menuId,
  })
}

export function useAddPositionToMenu(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ positionId, sortOrder }: { positionId: string; sortOrder: number }) =>
      menusService.addPositionToMenu(menuId, positionId, sortOrder),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId, 'positions'] })
      qc.invalidateQueries({ queryKey: POSITIONS_KEY })
    },
  })
}

export function useRemoveMenuPosition(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => menusService.removeMenuPosition(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId, 'positions'] })
      qc.invalidateQueries({ queryKey: POSITIONS_KEY })
    },
  })
}

export function useSetMenuPositionPrice(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, price }: { id: string; price: number | null }) =>
      menusService.setMenuPositionPrice(id, price),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId, 'positions'] }),
  })
}

export function useSetMenuPositionAddOn(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isAddOn }: { id: string; isAddOn: boolean }) =>
      menusService.setMenuPositionAddOn(id, isAddOn),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId, 'positions'] }),
  })
}

export function useReorderMenuPositions(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      menusService.reorderMenuPositions(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId, 'positions'] }),
  })
}

