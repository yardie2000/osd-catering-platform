import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { createServerClient } from '@/lib/supabase/server'

type ConnectionStatus = 'ok' | 'error' | 'not_configured'

async function checkConnection(): Promise<{ status: ConnectionStatus; detail: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const placeholder = 'https://your-project.supabase.co'

  if (!url || url === placeholder) {
    return { status: 'not_configured', detail: 'ENV-Variablen nicht gesetzt' }
  }

  try {
    const client = createServerClient()
    const { error } = await client
      .from('units')
      .select('id', { head: true, count: 'exact' })
    if (error) return { status: 'error', detail: error.message }
    return { status: 'ok', detail: 'Verbunden — Schema V4.2 aktiv' }
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : 'Unbekannter Fehler' }
  }
}

export default async function SettingsPage() {
  const connection = await checkConnection()

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'not set'
  const hasAnonKey   = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  const statusVariant =
    connection.status === 'ok'             ? 'success'   :
    connection.status === 'not_configured' ? 'secondary' : 'error'

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Einstellungen" description="Plattformkonfiguration, Schema-Status und V4.2-Roadmap" />
      <div className="p-8 space-y-6 max-w-2xl">

        {/* Connection status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Supabase-Verbindung</CardTitle>
              <Badge variant={statusVariant}>
                {connection.status === 'ok'             ? 'Verbunden'         :
                 connection.status === 'not_configured' ? 'Nicht konfiguriert' : 'Fehler'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground font-mono">NEXT_PUBLIC_SUPABASE_URL</p>
              <p className="font-mono text-sm break-all">{supabaseUrl}</p>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              <Badge variant={hasAnonKey ? 'success' : 'error'}>{hasAnonKey ? 'Gesetzt' : 'Fehlt'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</span>
              <Badge variant={hasServiceKey ? 'success' : 'error'}>{hasServiceKey ? 'Gesetzt' : 'Fehlt'}</Badge>
            </div>
            {connection.status !== 'not_configured' && (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground">{connection.detail}</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Schema status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Schema-Status</CardTitle>
              <Badge variant="success">V4.2</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p className="text-xs">
              Stammdaten, Rezepte und Menüs sind aktiv. In V4.2 ist die Menü-↔-Rezept-Verknüpfung
              vereinheitlicht: Jede Menüzeile kann direkt in der Oberfläche mit einem Rezept verknüpft
              werden — die Grundlage für die kommenden Produktions- und Einkaufsmodule.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
              <span className="text-foreground">menus.menu_name</span>        <span>✓ aktiv</span>
              <span className="text-foreground">menus.menu_description</span> <span>✓ aktiv</span>
              <span className="text-foreground">positions</span>             <span>✓ aktiv (geteilter Katalog, V5 — ersetzt menu_items)</span>
              <span className="text-foreground">menu_positions / position_components</span><span>✓ aktiv (Menü ↔ Position ↔ Komponenten)</span>
              <span className="text-foreground">recipes / recipe_ingredients</span><span>✓ aktiv</span>
              <span className="text-foreground">supplier_products</span>      <span>✓ aktiv</span>
              <span className="text-foreground">kitchen_batches</span>        <span>✓ aktiv (V4.1 — zentrale Planungseingabe)</span>
              <span className="text-foreground">kitchen_batch_items</span>   <span>✓ aktiv (Menü + Personenzahl)</span>
              <span className="text-foreground">production_batches</span>     <span>— Altbestand (vor V4.1)</span>
              <span className="text-foreground">purchasing_lists</span>       <span>— Altbestand (vor V4.1)</span>
              <span className="text-foreground">menu_recipes</span>           <span>— in V3 entfernt</span>
              <span className="text-foreground">menus.service_note</span>     <span>— in V3 entfernt</span>
              <span className="text-foreground">menus.menu_type</span>        <span>— in V3 entfernt</span>
            </div>
          </CardContent>
        </Card>

        {/* V4.1 Operations workflow */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Betriebsablauf (V4.1)</CardTitle>
              <Badge variant="success">Aktiv</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs">
              Eine Planungseingabe, zwei abgeleitete Ausgaben. Die Küchenleitung erfasst Menüs + Personenzahl
              <span className="text-foreground"> einmalig</span> in einem <span className="font-mono text-foreground">/operations/batches</span>
              {' '}Produktionslauf (Events werden in Mouseclick verwaltet). Produktion und Einkauf sind keine
              getrennten Eingaben mehr — beide werden über einen gemeinsamen Aggregationsdienst aus demselben
              Produktionslauf berechnet und können daher nie auseinanderlaufen.
            </p>
            <p className="text-xs text-foreground">Menüs + Personenzahl → Produktionslauf → Rezeptaggregation → Produktionsausgabe &amp; Einkaufsausgabe</p>
          </CardContent>
        </Card>

        {/* Production Output */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Produktionsausgabe</CardTitle>
              <Badge variant="success">Aktiv</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs"><span className="font-mono text-foreground">/operations/production</span> — abgeleitet aus dem gewählten Produktionslauf.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>✓ Produktionsmenge je Rezept (über Menüs hinweg verwendete Rezepte werden zusammengeführt + summiert)</li>
              <li>✓ Skalierung auf Personenzahl (Personen/Portionen → Lauffaktor; Ausbeute / production_notes / Standardbasis)</li>
              <li>✓ Zutatenliste je Lauf (skaliert)</li>
              <li>✓ Küchen-Produktionsblatt (Druck) + CSV</li>
            </ul>
          </CardContent>
        </Card>

        {/* Purchasing Output */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Einkaufsausgabe</CardTitle>
              <Badge variant="success">Aktiv</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs"><span className="font-mono text-foreground">/operations/purchasing</span> — abgeleitet aus demselben Produktionslauf (keine zweite Eingabe).</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>✓ Zutatenaggregation über alle Menüs/Rezepte des Laufs</li>
              <li>✓ Nach Kategorie gruppiert; Einheitenzusammenführung (kg→g, l→ml), sodass jede Zutat eine Zeile bildet</li>
              <li>✓ Einkaufsblatt (Druck) + CSV</li>
              <li>◷ Kostenschätzung &amp; Lieferantengruppierung — bereit, benötigt aber supplier_products-Daten (derzeit leer)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Further scaffolding */}
        <Card>
          <CardHeader><CardTitle className="text-base">Weitere Module in Vorbereitung</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Weitere Bereiche mit bereits angelegten Tabellen/Typen, die nach den obigen Modulen aktiviert werden:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Events &amp; Event-Menüs</li>
              <li>Lieferantenverwaltung</li>
              <li>Wareneinsatzkalkulation</li>
              <li>KI-Menüerkennung / Rezeptzuordnung / Zutaten-Mapping</li>
            </ul>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
