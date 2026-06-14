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
    return { status: 'not_configured', detail: 'ENV vars not set' }
  }

  try {
    const client = createServerClient()
    const { error } = await client
      .from('units')
      .select('id', { head: true, count: 'exact' })
    if (error) return { status: 'error', detail: error.message }
    return { status: 'ok', detail: 'Connected — schema V4.2 active' }
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : 'Unknown error' }
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
      <PageHeader title="Settings" description="Platform configuration, schema status and V4.2 roadmap" />
      <div className="p-8 space-y-6 max-w-2xl">

        {/* Connection status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Supabase Connection</CardTitle>
              <Badge variant={statusVariant}>
                {connection.status === 'ok'             ? 'Connected'      :
                 connection.status === 'not_configured' ? 'Not Configured' : 'Error'}
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
              <Badge variant={hasAnonKey ? 'success' : 'error'}>{hasAnonKey ? 'Set' : 'Missing'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-mono text-xs">SUPABASE_SERVICE_ROLE_KEY</span>
              <Badge variant={hasServiceKey ? 'success' : 'error'}>{hasServiceKey ? 'Set' : 'Missing'}</Badge>
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
              <CardTitle className="text-base">Schema Status</CardTitle>
              <Badge variant="success">V4.2</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-muted-foreground">
            <p className="text-xs">
              Master data, recipes and menus are live. In V4.2 the menu&nbsp;↔&nbsp;recipe
              link is unified: every menu line can be linked to a recipe directly in the UI,
              which is the basis for the upcoming production and purchasing modules.
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
              <span className="text-foreground">menus.menu_name</span>        <span>✓ active</span>
              <span className="text-foreground">menus.menu_description</span> <span>✓ active</span>
              <span className="text-foreground">menu_items</span>             <span>✓ active (replaces menu_recipes)</span>
              <span className="text-foreground">menu_items.recipe_id</span>   <span>✓ active (menu ↔ recipe link)</span>
              <span className="text-foreground">recipes / recipe_ingredients</span><span>✓ active</span>
              <span className="text-foreground">supplier_products</span>      <span>✓ active</span>
              <span className="text-foreground">kitchen_batches</span>        <span>✓ active (V4.1 — single planning entry)</span>
              <span className="text-foreground">kitchen_batch_items</span>   <span>✓ active (menu + pax)</span>
              <span className="text-foreground">production_batches</span>     <span>— legacy (pre-V4.1)</span>
              <span className="text-foreground">purchasing_lists</span>       <span>— legacy (pre-V4.1)</span>
              <span className="text-foreground">menu_recipes</span>           <span>— dropped in V3</span>
              <span className="text-foreground">menus.service_note</span>     <span>— dropped in V3</span>
              <span className="text-foreground">menus.menu_type</span>        <span>— dropped in V3</span>
            </div>
          </CardContent>
        </Card>

        {/* V4.1 Operations workflow */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Operations Workflow (V4.1)</CardTitle>
              <Badge variant="success">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs">
              One planning entry, two derived outputs. The kitchen lead enters menus + pax
              <span className="text-foreground"> once</span> in a <span className="font-mono text-foreground">/operations/batches</span>
              {' '}Production Batch (events are managed in Mouseclick). Production and Purchasing are no longer
              separate inputs — both are computed from the same batch via a shared aggregation service, so they
              can never diverge.
            </p>
            <p className="text-xs text-foreground">Menüs + Pax → Production Batch → Rezeptaggregation → Production Output &amp; Purchasing Output</p>
          </CardContent>
        </Card>

        {/* Production Output */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Production Output</CardTitle>
              <Badge variant="success">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs"><span className="font-mono text-foreground">/operations/production</span> — derived from the selected batch.</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>✓ Production batch per recipe (recipes used across menus are merged + summed)</li>
              <li>✓ Scaling to guest count (pax/portions → batch factor; yield / production_notes / default basis)</li>
              <li>✓ Per-batch prep ingredient list (scaled)</li>
              <li>✓ Kitchen Production Sheet (print) + CSV</li>
            </ul>
          </CardContent>
        </Card>

        {/* Purchasing Output */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Purchasing Output</CardTitle>
              <Badge variant="success">Live</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p className="text-xs"><span className="font-mono text-foreground">/operations/purchasing</span> — derived from the same batch (no second entry).</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>✓ Ingredient aggregation across all menus/recipes of the batch</li>
              <li>✓ Grouped by category; unit merging (kg→g, l→ml) so each ingredient is one line</li>
              <li>✓ Purchasing Sheet (print) + CSV</li>
              <li>◷ Cost estimate &amp; supplier grouping — ready, but needs supplier_products data (currently empty)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Further scaffolding */}
        <Card>
          <CardHeader><CardTitle className="text-base">Further Scaffolding</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Additional areas with tables/types in place, to be activated after the modules above:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Events &amp; Event Menus</li>
              <li>Supplier Management</li>
              <li>Food Cost Calculation</li>
              <li>AI Menu Recognition / Recipe Matching / Ingredient Mapping</li>
            </ul>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
