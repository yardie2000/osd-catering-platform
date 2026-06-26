import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createServerClient } from '@/lib/supabase/server'
import { parseProduktbedarfCsv } from '@/lib/produktbedarf/parse'
import {
  buildProduktbedarfImportDraft,
  type ImportCatalogMenu,
  type ProduktbedarfImportDraft,
} from '@/lib/produktbedarf/importPipeline'
import type { Database, ImportedReviewStatus } from '@/types/database'

export const runtime = 'nodejs'
export const maxDuration = 60

type Client = SupabaseClient<Database>

type SavedImportResponse = {
  jobId: string
  draft: ProduktbedarfImportDraft
  events: SavedImportedEvent[]
  catalog: ImportCatalogMenu[]
}

type SavedSelectedItem = {
  id: string
  imported_event_order_id: string
  sort_order: number
  raw_position_text: string
  matched_menu_item_id: string | null
  matched_recipe_id: string | null
  confidence: number
  needs_review: boolean
  original_text: string
  position_name?: string | null
}

type SavedOrder = {
  id: string
  imported_event_id: string
  source_row_number: number
  product_name: string
  long_description: string
  original_import_text: string
  total_quantity: number
  event_pax: number
  unit: string
  category: string
  raw_orders: string
  raw_event_order: string
  matched_menu_id: string | null
  matched_menu_name: string | null
  menu_confidence: number
  menu_match_strategy: string
  variant_label: string | null
  variant_item_count: number | null
  variant_confidence: number
  status: ImportedReviewStatus
  needs_review: boolean
  warnings: string[]
  selected_items: SavedSelectedItem[]
}

type SavedImportedEvent = {
  id: string
  import_job_id: string | null
  event_name: string
  normalized_event_name: string
  pax_count: number
  status: ImportedReviewStatus
  warnings: string[]
  source_filename: string | null
  orders: SavedOrder[]
}

type RawCatalogComponent = {
  recipe_id: string | null
  recipe: { id: string; recipe_code: string; name: string } | null
}

type RawCatalogPosition = {
  id: string
  position_code: string | null
  name: string
  position_components?: RawCatalogComponent[] | null
}

type RawCatalogMenuPosition = {
  sort_order: number | null
  position: RawCatalogPosition | null
}

type RawCatalogMenu = {
  id: string
  menu_code: string
  menu_name: string
  category: string | null
  menu_positions?: RawCatalogMenuPosition[] | null
}

type RawSavedSelectedItem = SavedSelectedItem & {
  position: { name: string } | null
}

async function loadCatalog(client: Client): Promise<ImportCatalogMenu[]> {
  const { data, error } = await client
    .from('menus')
    .select(`
      id,
      menu_code,
      menu_name,
      category,
      menu_positions(
        sort_order,
        position:positions(
          id,
          position_code,
          name,
          position_components(
            recipe_id,
            recipe:recipes(id, recipe_code, name)
          )
        )
      )
    `)
    .eq('active', true)
    .order('menu_name')

  if (error) throw error

  return ((data ?? []) as unknown as RawCatalogMenu[]).map((menu) => ({
    id: menu.id,
    menu_code: menu.menu_code,
    menu_name: menu.menu_name,
    category: menu.category,
    positions: (menu.menu_positions ?? [])
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((mp) => mp.position)
      .filter((position): position is RawCatalogPosition => Boolean(position))
      .map((position) => ({
        id: position.id,
        position_code: position.position_code,
        name: position.name,
        recipeIds: (position.position_components ?? [])
          .map((component) => component.recipe_id)
          .filter((recipeId): recipeId is string => Boolean(recipeId)),
        recipes: (position.position_components ?? [])
          .map((component) => component.recipe)
          .filter((recipe): recipe is { id: string; recipe_code: string; name: string } => Boolean(recipe)),
      })),
  }))
}

function statusFromWarnings(warnings: string[]): ImportedReviewStatus {
  return warnings.length > 0 ? 'needs_review' : 'matched'
}

async function markDuplicates(client: Client, draft: ProduktbedarfImportDraft) {
  const names = [...new Set(draft.events.map((event) => event.normalizedEventName))]
  if (names.length === 0) return
  const { data, error } = await client
    .from('imported_events')
    .select('normalized_event_name')
    .in('normalized_event_name', names)

  if (error) throw error
  const duplicates = new Set((data ?? []).map((event) => event.normalized_event_name))
  for (const event of draft.events) {
    if (duplicates.has(event.normalizedEventName)) {
      event.warnings = [...new Set([...event.warnings, 'Event wurde bereits importiert'])]
      event.status = 'needs_review'
      for (const order of event.orders) {
        order.warnings = [...new Set([...order.warnings, 'Event wurde bereits importiert'])]
        order.status = 'needs_review'
      }
    }
  }
}

async function persistDraft(
  client: Client,
  draft: ProduktbedarfImportDraft,
  filename: string,
): Promise<string> {
  const { data: job, error: jobError } = await client
    .from('import_jobs')
    .insert({
      filename,
      status: 'running',
      dry_run: false,
      total_rows: draft.totalRows,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      finished_at: null,
      created_by: null,
    })
    .select('id')
    .single()

  if (jobError) throw jobError

  let inserted = 0
  let errors = 0

  for (const event of draft.events) {
    const { data: savedEvent, error: eventError } = await client
      .from('imported_events')
      .insert({
        import_job_id: job.id,
        event_name: event.eventName,
        normalized_event_name: event.normalizedEventName,
        pax_count: event.pax,
        status: event.status,
        warnings: event.warnings,
        source_filename: filename,
      })
      .select('id')
      .single()

    if (eventError) {
      errors++
      throw eventError
    }

    for (const order of event.orders) {
      const { data: savedOrder, error: orderError } = await client
        .from('imported_event_orders')
        .insert({
          imported_event_id: savedEvent.id,
          import_job_id: job.id,
          source_row_number: order.sourceRowNumber,
          product_name: order.produkt,
          long_description: order.langbezeichnung,
          original_import_text: order.originalImportText,
          total_quantity: order.menge,
          event_pax: order.eventPax,
          unit: order.einheit,
          category: order.klassifizierung,
          raw_orders: order.auftraege,
          raw_event_order: order.rawAuftragText,
          matched_menu_id: order.menuMatch.menu?.id ?? null,
          matched_menu_name: order.menuMatch.menu?.menu_name ?? null,
          menu_confidence: order.menuMatch.confidence,
          menu_match_strategy: order.menuMatch.strategy,
          variant_label: order.variant.label,
          variant_item_count: order.variant.itemCount,
          variant_confidence: order.variant.confidence,
          status: order.status,
          needs_review: order.status === 'needs_review',
          warnings: order.warnings,
        })
        .select('id')
        .single()

      if (orderError) {
        errors++
        throw orderError
      }

      const selected = order.selectedItems.map((item, itemIndex) => ({
        imported_event_order_id: savedOrder.id,
        sort_order: itemIndex,
        raw_position_text: item.rawPositionText,
        matched_menu_item_id: item.matchedMenuItemId,
        matched_recipe_id: item.matchedRecipeId,
        confidence: item.confidence,
        needs_review: item.needsReview,
        original_text: item.originalText,
      }))

      if (selected.length > 0) {
        const { error: itemError } = await client
          .from('imported_event_selected_items')
          .insert(selected)
        if (itemError) {
          errors++
          throw itemError
        }
      }

      inserted++
    }
  }

  const { error: finishError } = await client
    .from('import_jobs')
    .update({
      status: errors > 0 ? 'failed' : 'completed',
      inserted,
      errors,
      finished_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  if (finishError) throw finishError
  return job.id
}

async function loadSavedImport(client: Client, jobId: string): Promise<SavedImportedEvent[]> {
  const [{ data: events, error: eventError }, { data: orders, error: orderError }, { data: items, error: itemError }] =
    await Promise.all([
      client.from('imported_events').select('*').eq('import_job_id', jobId).order('event_name'),
      client.from('imported_event_orders').select('*').eq('import_job_id', jobId).order('source_row_number'),
      client
        .from('imported_event_selected_items')
        .select('*, position:positions(name)')
        .order('sort_order'),
    ])

  if (eventError) throw eventError
  if (orderError) throw orderError
  if (itemError) throw itemError

  const orderIds = new Set((orders ?? []).map((order) => order.id))
  const itemsByOrder = new Map<string, SavedSelectedItem[]>()
  for (const item of (items ?? []) as unknown as RawSavedSelectedItem[]) {
    if (!orderIds.has(item.imported_event_order_id)) continue
    const list = itemsByOrder.get(item.imported_event_order_id) ?? []
    list.push({
      id: item.id,
      imported_event_order_id: item.imported_event_order_id,
      sort_order: item.sort_order,
      raw_position_text: item.raw_position_text,
      matched_menu_item_id: item.matched_menu_item_id,
      matched_recipe_id: item.matched_recipe_id,
      confidence: item.confidence,
      needs_review: item.needs_review,
      original_text: item.original_text,
      position_name: item.position?.name ?? null,
    })
    itemsByOrder.set(item.imported_event_order_id, list)
  }

  const ordersByEvent = new Map<string, SavedOrder[]>()
  for (const order of orders ?? []) {
    const list = ordersByEvent.get(order.imported_event_id) ?? []
    list.push({ ...order, selected_items: itemsByOrder.get(order.id) ?? [] })
    ordersByEvent.set(order.imported_event_id, list)
  }

  return (events ?? []).map((event) => ({
    ...event,
    orders: ordersByEvent.get(event.id) ?? [],
  }))
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'Only .csv files are supported' }, { status: 400 })
    }

    const client = createServerClient()
    const catalog = await loadCatalog(client)
    const rows = parseProduktbedarfCsv(await file.text())
    const draft = buildProduktbedarfImportDraft(rows, catalog)
    await markDuplicates(client, draft)

    if (dryRun) {
      return NextResponse.json({ jobId: null, draft, events: [], catalog })
    }

    const jobId = await persistDraft(client, draft, file.name)
    const events = await loadSavedImport(client, jobId)

    return NextResponse.json({ jobId, draft, events, catalog } satisfies SavedImportResponse)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

    const client = createServerClient()
    const [events, catalog] = await Promise.all([
      loadSavedImport(client, jobId),
      loadCatalog(client),
    ])

    return NextResponse.json({ jobId, events, catalog })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type ReviewPatch = {
  jobId: string
  orders: Array<{
    id: string
    imported_event_id: string
    event_pax: number
    matched_menu_id: string | null
    variant_label: string | null
    variant_item_count: number | null
    selected_items: Array<{
      raw_position_text: string
      matched_menu_item_id: string | null
      matched_recipe_id: string | null
      confidence?: number
      needs_review?: boolean
      original_text?: string
    }>
  }>
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as ReviewPatch
    if (!body.jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

    const client = createServerClient()
    const catalog = await loadCatalog(client)
    const menuById = new Map(catalog.map((menu) => [menu.id, menu]))
    const positionById = new Map(catalog.flatMap((menu) => menu.positions.map((position) => [position.id, position])))

    for (const order of body.orders) {
      const menu = order.matched_menu_id ? menuById.get(order.matched_menu_id) : null
      const { data: existingItems, error: existingItemsError } = await client
        .from('imported_event_selected_items')
        .select('sort_order, original_text')
        .eq('imported_event_order_id', order.id)
      if (existingItemsError) throw existingItemsError
      const originalTextBySortOrder = new Map(
        (existingItems ?? []).map((item) => [item.sort_order, item.original_text ?? '']),
      )
      const selected = order.selected_items.map((item, index) => {
        const position = item.matched_menu_item_id ? positionById.get(item.matched_menu_item_id) : null
        return {
          imported_event_order_id: order.id,
          sort_order: index,
          raw_position_text: item.raw_position_text,
          matched_menu_item_id: item.matched_menu_item_id,
          matched_recipe_id: item.matched_recipe_id ?? position?.recipeIds[0] ?? null,
          confidence: item.confidence ?? (item.matched_menu_item_id ? 1 : 0),
          needs_review: item.needs_review ?? !item.matched_menu_item_id,
          original_text: item.original_text ?? originalTextBySortOrder.get(index) ?? '',
        }
      })

      const warnings: string[] = []
      if (!menu) warnings.push('Menu muss geprueft werden')
      if (order.variant_item_count != null && selected.length !== order.variant_item_count) {
        warnings.push(`Variante ${order.variant_label ?? ''}, aber ${selected.length} Positionen gespeichert`)
      }
      if (selected.some((item) => item.needs_review || !item.matched_menu_item_id)) {
        warnings.push('Mindestens eine Position muss geprueft werden')
      }
      const status = statusFromWarnings(warnings)

      const { error: updateError } = await client
        .from('imported_event_orders')
        .update({
          event_pax: order.event_pax,
          matched_menu_id: menu?.id ?? null,
          matched_menu_name: menu?.menu_name ?? null,
          menu_confidence: menu ? 1 : 0,
          menu_match_strategy: 'review',
          variant_label: order.variant_label,
          variant_item_count: order.variant_item_count,
          variant_confidence: order.variant_label ? 1 : 0,
          status,
          needs_review: status === 'needs_review',
          warnings,
        })
        .eq('id', order.id)
      if (updateError) throw updateError

      const { error: deleteError } = await client
        .from('imported_event_selected_items')
        .delete()
        .eq('imported_event_order_id', order.id)
      if (deleteError) throw deleteError

      if (selected.length > 0) {
        const { error: insertError } = await client
          .from('imported_event_selected_items')
          .insert(selected)
        if (insertError) throw insertError
      }
    }

    const eventIds = [...new Set(body.orders.map((order) => order.imported_event_id))]
    for (const eventId of eventIds) {
      const { data: orders, error } = await client
        .from('imported_event_orders')
        .select('status, warnings, event_pax')
        .eq('imported_event_id', eventId)
      if (error) throw error
      const warnings = [...new Set((orders ?? []).flatMap((order) => order.warnings ?? []))]
      const status: ImportedReviewStatus = (orders ?? []).some((order) => order.status === 'needs_review')
        ? 'needs_review'
        : 'reviewed'
      const pax = Math.max(...(orders ?? []).map((order) => order.event_pax), 0)
      const { error: eventUpdateError } = await client
        .from('imported_events')
        .update({
          status,
          warnings,
          pax_count: pax,
          reviewed_at: status === 'reviewed' ? new Date().toISOString() : null,
        })
        .eq('id', eventId)
      if (eventUpdateError) throw eventUpdateError
    }

    const events = await loadSavedImport(client, body.jobId)
    return NextResponse.json({ jobId: body.jobId, events, catalog })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
