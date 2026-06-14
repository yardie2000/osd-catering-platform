'use client'

import { useState } from 'react'
import { useRecipes } from '@/hooks/use-recipes'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Check } from 'lucide-react'
import type { Recipe } from '@/types'

type MenuRecipePickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (recipe: Recipe) => void
  /** Currently linked recipe, highlighted + marked in the list. */
  selectedRecipeId?: string | null
  title?: string
  description?: string
}

/**
 * Lightweight, touch-friendly recipe search/select used to link a menu
 * line to a recipe. Searches by recipe name and code, renders a single
 * scrollable list (no nested modals), and is dark-UI / shadcn compatible.
 */
export function MenuRecipePicker({
  open,
  onOpenChange,
  onSelect,
  selectedRecipeId,
  title = 'Rezept verknüpfen',
  description = 'Nach Rezeptname oder -code suchen und zum Verknüpfen tippen.',
}: MenuRecipePickerProps) {
  const [search, setSearch] = useState('')
  const trimmed = search.trim()
  const { data: recipes = [], isLoading } = useRecipes(trimmed ? { search: trimmed } : undefined)

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setSearch('')
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="z. B. Haselnuss-Sauce oder SAU-004"
            className="pl-9"
          />
        </div>

        <div className="-mx-1 max-h-[55vh] space-y-1 overflow-y-auto px-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rezepte werden geladen…</p>
          ) : recipes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine Rezepte gefunden{trimmed ? ` für „${trimmed}“` : ''}.
            </p>
          ) : (
            recipes.map((r) => {
              const isSelected = r.id === selectedRecipeId
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(r)}
                  data-selected={isSelected}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:border-primary data-[selected=true]:bg-accent/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{r.recipe_code}</span>
                  </span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Badge variant="outline" className="shrink-0">Verknüpfen</Badge>
                  )}
                </button>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
