'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { cn } from '@/lib/utils'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col md:ml-72">
        <div className="sticky top-0 z-30 border-b bg-card/90 px-4 py-3 backdrop-blur-sm md:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold tracking-tight">Catering OS</p>
              <p className="text-xs text-muted-foreground">Menü · Rezept · Zutat</p>
            </div>
            <button
              type="button"
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-lg border bg-card text-foreground transition hover:border-border hover:bg-accent',
              )}
              onClick={() => setMobileOpen(true)}
              aria-label="Navigation öffnen"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
