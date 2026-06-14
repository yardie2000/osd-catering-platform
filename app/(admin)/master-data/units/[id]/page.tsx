'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'

import { useUnit } from '@/hooks/use-units'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-2 last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: unit, isLoading } = useUnit(id)

  if (isLoading) {
    return <div className="p-6">Laden…</div>
  }

  if (!unit) {
    return <div className="p-6">Einheit nicht gefunden.</div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={unit.name}
        description={`Einheitencode ${unit.unit_code}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/master-data/units">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/master-data/units/${unit.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </Link>
            </Button>
          </div>
        }
      />

      <div className="px-8 pb-8">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Einheitendetails</CardTitle>
          </CardHeader>
          <CardContent>
            <DataRow label="Kürzel / Code" value={unit.unit_code} />
            <DataRow label="Name" value={unit.name} />
            <DataRow label="Kurzname" value={unit.short_name ?? '—'} />
            <DataRow label="Basiseinheit" value={unit.base_unit ?? '—'} />
            <DataRow
              label="Umrechnungsfaktor"
              value={unit.conversion_factor != null ? unit.conversion_factor : '—'}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
