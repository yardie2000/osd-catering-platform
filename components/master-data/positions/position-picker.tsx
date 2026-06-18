'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

import { usePositions } from '@/hooks/use-positions'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { PositionListRow } from '@/services/positions.service'

type PositionPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (position: PositionListRow) => void
  /** Positions already in the menu — hidden from the list. */
  excludeIds?: string[]
}

export function PositionPicker({ open, onOpenChange, onSelect, excludeIds = [] }: PositionPickerProps) {
  const [search, setSearch] = useState('')
  const trimmed = search.trim()
  const { data: positions = [], isLoading } = usePositions(trimmed || undefined)
  const exclude = new Set(excludeIds)
  const visible = positions.filter((p) => !exclude.has(p.id))

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSearch('') }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorhandene Position hinzufügen</DialogTitle>
          <DialogDescription>Position aus dem Katalog suchen und anklicken.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="z. B. Kartoffelsalat oder POS-0003" className="pl-9"
          />
        </div>

        <div className="-mx-1 max-h-[55vh] space-y-1 overflow-y-auto px-1">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Positionen werden geladen…</p>
          ) : visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine passende Position{trimmed ? ` für „${trimmed}“` : ''}.
            </p>
          ) : (
            visible.map((p) => (
              <button
                key={p.id} type="button" onClick={() => onSelect(p)}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.position_code ? `${p.position_code} · ` : ''}{p.componentCount} Komponente(n){p.dietary ? ` · ${p.dietary}` : ''}
                  </span>
                </span>
                {p.usageCount > 0
                  ? <Badge variant="secondary" className="shrink-0">in {p.usageCount} Menü(s)</Badge>
                  : <Badge variant="outline" className="shrink-0">neu nutzen</Badge>}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
