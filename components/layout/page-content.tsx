import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Einheitlicher Seiteninhalt-Container (Design-Sprache): gleiches responsives
 * Padding und gleicher vertikaler Abstand auf allen Listen-/Detailseiten.
 * Ersetzt uneinheitliche `p-8` / `p-4 sm:p-6 lg:p-8`-Varianten.
 */
export function PageContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('space-y-4 p-4 sm:p-6 lg:p-8', className)}>{children}</div>
}
