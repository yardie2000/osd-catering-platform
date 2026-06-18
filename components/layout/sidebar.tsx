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
}

function NavItem({ label, href, icon: Icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
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
          'fixed inset-y-0 left-0 z-50 w-72 max-w-full overflow-y-auto border-r bg-card shadow-xl transition-transform duration-300 md:static md:translate-x-0 md:shadow-none',
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-foreground md:hidden"
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
                  {group.children.map((item) => (
                    <NavItem
                      key={item.href}
                      label={item.label}
                      href={item.href}
                      icon={item.icon}
                      active={pathname === item.href || pathname.startsWith(item.href + '/')}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t p-4 text-center">
          <p className="text-[10px] text-muted-foreground">OSD Catering Platform V4.5</p>
        </div>
      </aside>
    </>
  )
}
