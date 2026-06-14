import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { menusService } from '@/services/menus.service'
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

export function useAddMenuItem(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      item,
      sortOrder,
    }: {
      item: {
        name: string
        description?: string | null
        dietary?: string | null
        item_price?: number | null
        recipe_id?: string | null
      }
      sortOrder: number
    }) => menusService.addItem(menuId, item, sortOrder),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId] }),
  })
}

// Link, change or clear (recipeId = null) the recipe behind a menu line.
export function useSetMenuItemRecipe(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ menuItemId, recipeId }: { menuItemId: string; recipeId: string | null }) =>
      menusService.setItemRecipe(menuItemId, recipeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId] }),
  })
}

export function useReorderMenuItems(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (items: { id: string; sort_order: number }[]) =>
      menusService.reorderItems(items),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId] }),
  })
}

export function useRemoveMenuItem(menuId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (menuItemId: string) => menusService.removeItem(menuItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENUS_KEY, menuId] }),
  })
}
