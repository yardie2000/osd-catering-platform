import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'

type StateBlockProps = {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function LoadingState({ label = 'Laden...' }: { label?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, description, action, className }: StateBlockProps) {
  return (
    <div className={cn('flex min-h-36 flex-col items-center justify-center gap-3 px-4 py-8 text-center', className)}>
      <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ title = 'Daten konnten nicht geladen werden', error, action, className }: {
  title?: string
  error: unknown
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm', className)} role="alert">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="font-medium text-destructive">{title}</p>
            <p className="mt-1 break-words text-muted-foreground">{getErrorMessage(error)}</p>
          </div>
          {action}
        </div>
      </div>
    </div>
  )
}
