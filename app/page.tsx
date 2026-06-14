'use client'

import { useUnits } from '@/hooks/use-units'
import { useIngredients } from '@/hooks/use-ingredients'
import { useRecipes } from '@/hooks/use-recipes'
import { useMenus } from '@/hooks/use-menus'
import { useImportJobs } from '@/hooks/use-imports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/page-header'
import { Ruler, Carrot, BookOpen, UtensilsCrossed, Upload, CheckCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  loading,
}: {
  title: string
  value: number | undefined
  icon: React.ComponentType<{ className?: string }>
  href: string
  loading: boolean
}) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{loading ? '...' : (value ?? 0)}</div>
        </CardContent>
      </Card>
    </Link>
  )
}

function importStatusBadge(status: string) {
  if (status === 'completed') return <Badge variant="success">Abgeschlossen</Badge>
  if (status === 'failed') return <Badge variant="error">Fehlgeschlagen</Badge>
  if (status === 'dry_run') return <Badge variant="warning">Testlauf</Badge>
  if (status === 'running') return <Badge variant="secondary">Läuft</Badge>
  return <Badge variant="outline">{status}</Badge>
}

export default function DashboardPage() {
  const { data: units, isLoading: loadingUnits } = useUnits()
  const { data: ingredients, isLoading: loadingIngredients } = useIngredients()
  const { data: recipes, isLoading: loadingRecipes } = useRecipes()
  const { data: menus, isLoading: loadingMenus } = useMenus()
  const { data: jobs } = useImportJobs()

  const recentJobs = (jobs ?? []).slice(0, 5)

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Dashboard"
        description="OSD Catering Operations Plattform — Rezept- & Produktionsverwaltung"
      />

      <div className="p-8 space-y-8">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Einheiten" value={units?.length} icon={Ruler} href="/master-data/units" loading={loadingUnits} />
          <StatCard title="Zutaten" value={ingredients?.length} icon={Carrot} href="/master-data/ingredients" loading={loadingIngredients} />
          <StatCard title="Rezepte" value={recipes?.length} icon={BookOpen} href="/master-data/recipes" loading={loadingRecipes} />
          <StatCard title="Menüs" value={menus?.length} icon={UtensilsCrossed} href="/master-data/menus" loading={loadingMenus} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Letzte Importe
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Noch keine Importe.{' '}
                  <Link href="/operations/imports" className="text-primary hover:underline">
                    Import starten
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map((job) => (
                    <Link key={job.id} href={`/operations/imports`} className="flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{job.filename}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(job.started_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {job.inserted}↑ {job.updated}↻ {job.errors}✗
                        </span>
                        {importStatusBadge(job.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Systemstatus</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Datenbank', status: 'verbunden', icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Rezept-Engine', status: 'bereit', icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Import-Engine', status: 'bereit', icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Events-Modul', status: 'in Kürze', icon: Clock, color: 'text-amber-400' },
                { label: 'Einkaufs-Modul', status: 'in Kürze', icon: Clock, color: 'text-amber-400' },
              ].map(({ label, status, icon: Icon, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`flex items-center gap-1.5 ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
