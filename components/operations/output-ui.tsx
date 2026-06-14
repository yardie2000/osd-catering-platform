'use client'

// Shared building blocks for the V4.2 Kitchen Operations dashboard
// (Production Output + Purchasing Output). Dense, dark, print-friendly.

import { cn } from '@/lib/utils'
import type { BaseSource, UnitClass } from '@/lib/purchasing/aggregate'

export const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
export const cf = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })

// Qualitative units ("Geschmack", "Bedarf", "EL", …) are NOT orderable amounts —
// scaling them produces nonsense (e.g. "37 Geschmack salt"). Render them as
// "n. Bedarf" (nach Bedarf = as needed). Physical/count units show the number.
export function QtyCell({
  value,
  unitClass,
  unitLabel,
  bold,
}: {
  value: number
  unitClass: UnitClass
  unitLabel: string
  bold?: boolean
}) {
  if (unitClass === 'qualitative') {
    return <span className="text-muted-foreground italic text-xs">n. Bedarf</span>
  }
  return (
    <span className="tabular-nums">
      <span className={cn(bold && 'font-semibold text-foreground')}>{nf.format(value)}</span>
      <span className="ml-1 text-xs text-muted-foreground">{unitLabel}</span>
    </span>
  )
}

// One figure in the sticky summary bar.
export function Stat({
  label,
  value,
  tone,
  sub,
}: {
  label: string
  value: React.ReactNode
  tone?: 'default' | 'primary' | 'warning' | 'muted'
  sub?: string
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-lg font-semibold leading-tight tabular-nums',
          tone === 'primary' && 'text-primary',
          tone === 'warning' && 'text-amber-400',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  )
}

// Sticky control + summary bar that pins to the top of the scroll area.
export function StickyBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'sticky top-0 z-20 border-b border-border bg-background/90 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 print:static print:bg-transparent print:backdrop-blur-none lg:px-8',
        className,
      )}
    >
      {children}
    </div>
  )
}

// Small label for how a recipe's portion base was determined.
export function baseSourceLabel(source: BaseSource): { text: string; tone: string } {
  if (source === 'base') return { text: 'Basisportionen', tone: 'border-emerald-500/40 text-emerald-400' }
  if (source === 'yield') return { text: 'Ertrag', tone: 'border-teal-500/40 text-teal-400' }
  if (source === 'notes') return { text: 'aus Notiz', tone: 'border-sky-500/40 text-sky-400' }
  return { text: 'Annahme', tone: 'border-amber-500/50 text-amber-400' }
}
