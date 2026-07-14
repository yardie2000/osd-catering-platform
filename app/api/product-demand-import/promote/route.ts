import { NextRequest, NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase/server'
import { detectNoDemand } from '@/lib/produktbedarf/parse'
import {
  aggregatePromotedItems,
  deriveBatchMeta,
  type PromoteOrderInput,
} from '@/lib/produktbedarf/promoteToProduction'

export const runtime = 'nodejs'
export const maxDuration = 60

// Übernimmt einen vollständig geprüften Bedarf-Import in einen Produktionslauf
// (kitchen_batch + items + gewählte Positionen). Gate: solange ein Order/Event
// noch needs_review ist, wird abgelehnt — nichts fließt halbgeprüft in die Küche.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { jobId?: string }
    const jobId = body?.jobId
    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 })

    const client = createServerClient()

    const { data: job, error: jobError } = await client
      .from('import_jobs')
      .select('id, filename')
      .eq('id', jobId)
      .single()
    if (jobError) throw jobError

    // Doppel-Übernahme verhindern: existiert schon ein Lauf aus diesem Import?
    const { data: existingBatch, error: existingError } = await client
      .from('kitchen_batches')
      .select('id')
      .eq('source_import_job_id', jobId)
      .limit(1)
      .maybeSingle()
    if (existingError) throw existingError
    if (existingBatch) {
      return NextResponse.json(
        { error: 'Dieser Import wurde bereits in die Produktion übernommen.', batchId: existingBatch.id },
        { status: 409 },
      )
    }

    const { data: events, error: eventsError } = await client
      .from('imported_events')
      .select('id, status')
      .eq('import_job_id', jobId)
    if (eventsError) throw eventsError
    if (!events || events.length === 0) {
      return NextResponse.json({ error: 'Keine Events zum Import gefunden.' }, { status: 400 })
    }

    const { data: orders, error: ordersError } = await client
      .from('imported_event_orders')
      .select('id, product_name, long_description, matched_menu_id, event_pax, status, needs_review')
      .eq('import_job_id', jobId)
    if (ordersError) throw ordersError

    // ── Gate: keine offenen Reviews ──────────────────────────
    const blocked =
      events.some((event) => event.status === 'needs_review') ||
      (orders ?? []).some((order) => order.needs_review || order.status === 'needs_review')
    if (blocked) {
      return NextResponse.json(
        { error: 'Es gibt noch offene Reviews. Erst alle Positionen prüfen, dann übernehmen.' },
        { status: 409 },
      )
    }

    // ── gewählte Positionen je Order ─────────────────────────
    const orderIds = (orders ?? []).map((order) => order.id)
    const { data: items, error: itemsError } = orderIds.length
      ? await client
          .from('imported_event_selected_items')
          .select('imported_event_order_id, matched_menu_item_id')
          .in('imported_event_order_id', orderIds)
      : { data: [], error: null }
    if (itemsError) throw itemsError

    const selectedByOrder = new Map<string, string[]>()
    for (const item of items ?? []) {
      if (!item.matched_menu_item_id) continue
      const list = selectedByOrder.get(item.imported_event_order_id) ?? []
      list.push(item.matched_menu_item_id)
      selectedByOrder.set(item.imported_event_order_id, list)
    }

    // ── alle Positions-IDs je zugeordnetem Menü (Katalog) ────
    const menuIds = [
      ...new Set((orders ?? []).map((order) => order.matched_menu_id).filter((id): id is string => Boolean(id))),
    ]
    const menuPositionIds = new Map<string, string[]>()
    if (menuIds.length) {
      const { data: mps, error: mpError } = await client
        .from('menu_positions')
        .select('menu_id, position_id')
        .in('menu_id', menuIds)
      if (mpError) throw mpError
      for (const mp of mps ?? []) {
        if (!mp.position_id) continue
        const list = menuPositionIds.get(mp.menu_id) ?? []
        list.push(mp.position_id)
        menuPositionIds.set(mp.menu_id, list)
      }
    }

    // ── Eingaben bauen + zusammenfassen ──────────────────────
    const inputs: PromoteOrderInput[] = (orders ?? []).map((order) => ({
      matchedMenuId: order.matched_menu_id,
      eventPax: Number(order.event_pax) || 0,
      noDemand: detectNoDemand(order.product_name, order.long_description ?? ''),
      selectedPositionIds: selectedByOrder.get(order.id) ?? [],
      menuPositionIds: order.matched_menu_id ? menuPositionIds.get(order.matched_menu_id) ?? [] : [],
    }))
    const promoted = aggregatePromotedItems(inputs)
    if (promoted.length === 0) {
      return NextResponse.json(
        { error: 'Keine produzierbaren Menüpositionen gefunden (nur Service-/Gebühr-Zeilen?).' },
        { status: 400 },
      )
    }

    // ── Produktionslauf anlegen ──────────────────────────────
    const meta = deriveBatchMeta(job.filename)
    const { data: batch, error: batchError } = await client
      .from('kitchen_batches')
      .insert({
        name: meta.name,
        start_date: meta.startDate,
        end_date: meta.endDate,
        production_date: meta.endDate ?? meta.startDate,
        status: 'planned',
        source_import_job_id: jobId,
      })
      .select('id')
      .single()
    if (batchError) throw batchError

    for (const item of promoted) {
      const { data: savedItem, error: itemError } = await client
        .from('kitchen_batch_items')
        .insert({ batch_id: batch.id, menu_id: item.menuId, pax_count: Math.round(item.paxCount) })
        .select('id')
        .single()
      if (itemError) throw itemError

      if (item.positionIds.length > 0) {
        const { error: posError } = await client
          .from('kitchen_batch_item_positions')
          .insert(item.positionIds.map((position_id) => ({ batch_item_id: savedItem.id, position_id })))
        if (posError) throw posError
      }
    }

    // ── Events als übernommen markieren (Herkunft + Doppelschutz) ──
    const { error: markError } = await client
      .from('imported_events')
      .update({ status: 'calculated' })
      .in('id', events.map((event) => event.id))
    if (markError) throw markError

    return NextResponse.json({ batchId: batch.id, items: promoted.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
