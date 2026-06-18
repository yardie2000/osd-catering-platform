'use client'

import { useState } from 'react'
import { ArrowRight, GitMerge, AlertTriangle, Layers } from 'lucide-react'
import { toast } from 'sonner'

import { useMergePositions } from '@/hooks/use-positions'
import { getErrorMessage } from '@/lib/errors'
import { PositionPicker } from '@/components/master-data/positions/position-picker'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { PositionListRow } from '@/services/positions.service'

type PositionMergeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The position that will be dissolved into the chosen target and deleted. */
  source: PositionListRow | null
}

function PositionChip({ p, tone }: { p: PositionListRow; tone: 'source' | 'target' }) {
  return (
    <div className={`rounded-md border p-3 ${tone === 'source' ? 'border-destructive/40 bg-destructive/5' : 'border-primary/40 bg-primary/5'}`}>
      <div className="font-medium truncate">{p.name}</div>
      {p.position_code && <div className="font-mono text-[11px] text-muted-foreground">{p.position_code}</div>}
      <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" />{p.componentCount} Komp.</span>
        <span>· in {p.usageCount} Menü(s)</span>
      </div>
    </div>
  )
}

export function PositionMergeDialog({ open, onOpenChange, source }: PositionMergeDialogProps) {
  const merge = useMergePositions()
  const [target, setTarget] = useState<PositionListRow | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  function close() {
    setTarget(null)
    onOpenChange(false)
  }

  async function handleMerge() {
    if (!source || !target) return
    try {
      await merge.mutateAsync({ sourceId: source.id, targetId: target.id })
      toast.success(`„${source.name}" in „${target.name}" zusammengeführt`)
      close()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  if (!source) return null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge className="h-5 w-5" /> Position zusammenführen</DialogTitle>
          <DialogDescription>
            Die Quell-Position wird in eine Zielposition überführt und anschließend gelöscht.
            Alle Menüs, die die Quelle nutzen, zeigen danach auf die Zielposition.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quelle (wird gelöscht)</p>
            <PositionChip p={source} tone="source" />
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ziel (bleibt)</p>
            {target ? (
              <button type="button" onClick={() => setPickerOpen(true)} className="w-full text-left">
                <PositionChip p={target} tone="target" />
              </button>
            ) : (
              <Button type="button" variant="outline" className="h-[72px] w-full" onClick={() => setPickerOpen(true)}>
                Zielposition wählen…
              </Button>
            )}
          </div>
        </div>

        <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p>Beim Zusammenführen:</p>
            <ul className="ml-3 list-disc space-y-0.5">
              <li>Menü-Zuordnungen der Quelle wandern aufs Ziel; ist das Ziel im selben Menü schon vorhanden, wird die Quell-Zuordnung verworfen.</li>
              <li>Komponenten, die das Ziel bereits hat (gleiches Rezept/Zutat), werden nicht doppelt übernommen — das Ziel behält seine Mengen.</li>
              <li>Die Quell-Position wird endgültig gelöscht. <span className="text-amber-500">Nicht umkehrbar.</span></li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>Abbrechen</Button>
          <Button variant="destructive" onClick={handleMerge} disabled={!target || merge.isPending}>
            <GitMerge className="h-4 w-4" /> Zusammenführen
          </Button>
        </DialogFooter>
      </DialogContent>

      <PositionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(p) => { setTarget(p); setPickerOpen(false) }}
        excludeIds={[source.id]}
      />
    </Dialog>
  )
}
