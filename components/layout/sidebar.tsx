'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Ruler,
  Carrot,
  BookOpen,
  UtensilsCrossed,
  Layers,
  Truck,
  Upload,
  ShieldCheck,
  BarChart3,
  ChefHat,
  ShoppingCart,
  ClipboardList,
  FileInput,
  Settings,
  ChevronRight,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavLeaf   = { label: string; href: string; icon: React.ComponentType<{ className?: string }> }
type NavGroup  = { label: string; children: NavLeaf[] }
type NavEntry  = NavLeaf | NavGroup

const nav: NavEntry[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  {
    label: 'Kernprozess',
    children: [
      { label: 'Menüs',       href: '/master-data/menus',        icon: UtensilsCrossed },
      { label: 'Positionen',  href: '/master-data/positions',    icon: Layers },
      { label: 'Rezepte',     href: '/master-data/recipes',      icon: BookOpen },
      { label: 'Zutaten',     href: '/master-data/ingredients',  icon: Carrot },
      { label: 'Lieferanten', href: '/master-data/ingredients/suppliers', icon: Truck },
      { label: 'Einheiten',   href: '/master-data/units',        icon: Ruler },
    ],
  },
  {
    label: 'Datenpflege',
    children: [
      { label: 'Importcenter',  href: '/operations/imports',      icon: Upload },
      { label: 'Validierung',   href: '/operations/validation',   icon: ShieldCheck },
      { label: 'Datenqualität', href: '/operations/data-quality', icon: BarChart3 },
    ],
  },
  {
    label: 'Betrieb',
    children: [
      { label: 'Bedarf-Import',      href: '/operations/bedarf-import', icon: FileInput },
      { label: 'Produktionsläufe',  href: '/operations/batches',     icon: ClipboardList },
      { label: 'Produktionsausgabe', href: '/operations/production',  icon: ChefHat },
      { label: 'Einkaufsausgabe',    href: '/operations/purchasing',  icon: ShoppingCart },
    ],
  },
  { label: 'Einstellungen', href: '/settings', icon: Settings },
]

interface NavItemProps {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onNavigate?: () => void
}

function NavItem({ label, href, icon: Icon, active, onNavigate }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground'
      )}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
      <span className="truncate">{label}</span>
      {active && <ChevronRight className="ml-auto h-3 w-3" />}
    </Link>
  )
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[88vw] overflow-y-auto border-r bg-card shadow-xl transition-transform duration-300 md:fixed md:translate-x-0 md:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <ChefHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">Catering OS</p>
              <p className="text-[10px] text-muted-foreground">Menü · Rezept · Zutat</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground md:hidden"
            onClick={onClose}
            aria-label="Navigation schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 p-3">
          {nav.map((section) => {
            if ('href' in section) {
              const leaf = section as NavLeaf
              return (
                <NavItem
                  key={leaf.href}
                  label={leaf.label}
                  href={leaf.href}
                  icon={leaf.icon}
                  active={pathname === leaf.href}
                  onNavigate={onClose}
                />
              )
            }
            const group = section as NavGroup
            return (
              <div key={group.label} className="mt-5 first:mt-0">
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.children.map((item) => {
                    // Nur den spezifischsten Treffer markieren: ein Eltern-Pfad
                    // (z. B. Zutaten) leuchtet NICHT, wenn ein längeres Geschwister
                    // (z. B. Lieferanten unter .../ingredients/suppliers) passt.
                    const isActive =
                      pathname === item.href ||
                      (pathname.startsWith(item.href + '/') &&
                        !group.children.some(
                          (o) =>
                            o.href.length > item.href.length &&
                            (pathname === o.href || pathname.startsWith(o.href + '/')),
                        ))
                    return (
                      <NavItem
                        key={item.href}
                        label={item.label}
                        href={item.href}
                        icon={item.icon}
                        active={isActive}
                        onNavigate={onClose}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t p-4 text-center">
          <p className="text-[10px] text-muted-foreground">OSD Catering Platform V5.2.1</p>
        </div>
      </aside>
    </>
  )
}
