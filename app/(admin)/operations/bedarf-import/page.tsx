'use client'

import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { menusService } from '@/services/menus.service'
import { positionsService } from '@/services/positions.service'
import { getErrorMessage } from '@/lib/errors'
import type { ImportCatalogMenu } from '@/lib/produktbedarf/importPipeline'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NO_MENU = '__no_menu__'
const NO_POSITION = '__no_position__'

type ReviewItem = {
  id?: string
  imported_event_order_id?: string
  sort_order: number
  raw_position_text: string
  matched_menu_item_id: string | null
  matched_recipe_id: string | null
  confidence: number
  needs_review: boolean
  original_text: string
  position_name?: string | null
}

type ReviewOrder = {
  id: string
  imported_event_id: string
  source_row_number: number
  product_name: string
  long_description: string
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
  status: string
  needs_review: boolean
  warnings: string[]
  selected_items: ReviewItem[]
}

type ReviewEvent = {
  id: string
  event_name: string
  pax_count: number
  status: string
  warnings: string[]
  source_filename: string | null
  orders: ReviewOrder[]
}

function statusBadge(status: string) {
  if (status === 'reviewed' || status === 'matched') {
    return <Badge variant="secondary">OK</Badge>
  }
  return <Badge variant="warning">Prüfen</Badge>
}

function countNeedsReview(events: ReviewEvent[]) {
  let orders = 0
  let items = 0
  for (const event of events) {
    for (const order of event.orders) {
      if (order.needs_review || order.status === 'needs_review') orders++
      items += order.selected_items.filter((item) => item.needs_review || !item.matched_menu_item_id).length
    }
  }
  return { orders, items }
}

export default function BedarfImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [events, setEvents] = useState<ReviewEvent[]>([])
  const [catalog, setCatalog] = useState<ImportCatalogMenu[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const menuById = useMemo(() => new Map(catalog.map((menu) => [menu.id, menu])), [catalog])
  const summary = useMemo(() => {
    const review = countNeedsReview(events)
    const orderCount = events.reduce((sum, event) => sum + event.orders.length, 0)
    const selectedCount = events.reduce(
      (sum, event) => sum + event.orders.reduce((inner, order) => inner + order.selected_items.length, 0),
      0,
    )
    return { review, orderCount, selectedCount }
  }, [events])

  function replaceOrder(orderId: string, updater: (order: ReviewOrder) => ReviewOrder) {
    setEvents((prev) =>
      prev.map((event) => ({
        ...event,
        orders: event.orders.map((order) => (order.id === orderId ? updater(order) : order)),
      })),
    )
  }

  function setOrderMenu(orderId: string, menuId: string) {
    replaceOrder(orderId, (order) => {
      const menu = menuId === NO_MENU ? null : menuById.get(menuId) ?? null
      return {
        ...order,
        matched_menu_id: menu?.id ?? null,
        matched_menu_name: menu?.menu_name ?? null,
        menu_confidence: menu ? 1 : 0,
        needs_review: true,
        status: 'needs_review',
        selected_items: order.selected_items.map((item) => ({
          ...item,
          matched_menu_item_id: null,
          matched_recipe_id: null,
          confidence: 0,
          needs_review: true,
        })),
      }
    })
  }

  function setOrderField(orderId: string, patch: Partial<ReviewOrder>) {
    replaceOrder(orderId, (order) => ({ ...order, ...patch, needs_review: true, status: 'needs_review' }))
  }

  function setItem(orderId: string, index: number, patch: Partial<ReviewItem>) {
    replaceOrder(orderId, (order) => ({
      ...order,
      needs_review: true,
      status: 'needs_review',
      selected_items: order.selected_items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }))
  }

  function selectPosition(orderId: string, index: number, positionId: string) {
    replaceOrder(orderId, (order) => {
      const menu = order.matched_menu_id ? menuById.get(order.matched_menu_id) : null
      const position = menu?.positions.find((candidate) => candidate.id === positionId) ?? null
      const selected_items = order.selected_items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              raw_position_text: position?.name ?? item.raw_position_text,
              matched_menu_item_id: positionId === NO_POSITION ? null : position?.id ?? null,
              matched_recipe_id: position?.recipeIds[0] ?? null,
              confidence: position ? 1 : 0,
              needs_review: !position || position.recipeIds.length === 0,
              position_name: position?.name ?? null,
            }
          : item,
      )
      return { ...order, selected_items, needs_review: true, status: 'needs_review' }
    })
  }

  function addItem(orderId: string) {
    replaceOrder(orderId, (order) => ({
      ...order,
      needs_review: true,
      status: 'needs_review',
      selected_items: [
        ...order.selected_items,
        {
          sort_order: order.selected_items.length,
          raw_position_text: '',
          matched_menu_item_id: null,
          matched_recipe_id: null,
          confidence: 0,
          needs_review: true,
          original_text: '',
        },
      ],
    }))
  }

  function removeItem(orderId: string, index: number) {
    replaceOrder(orderId, (order) => ({
      ...order,
      needs_review: true,
      status: 'needs_review',
      selected_items: order.selected_items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  async function createPositionForOrder(orderId: string) {
    const order = events.flatMap((event) => event.orders).find((candidate) => candidate.id === orderId)
    if (!order?.matched_menu_id) {
      toast.error('Bitte zuerst ein Menü wählen.')
      return
    }

    const name = window.prompt('Name der neuen Position')
    if (!name?.trim()) return

    try {
      const position = await positionsService.create({ name: name.trim() })
      const menu = menuById.get(order.matched_menu_id)
      await menusService.addPositionToMenu(order.matched_menu_id, position.id, menu?.positions.length ?? 0)

      setCatalog((prev) =>
        prev.map((catalogMenu) =>
          catalogMenu.id === order.matched_menu_id
            ? {
                ...catalogMenu,
                positions: [
                  ...catalogMenu.positions,
                  {
                    id: position.id,
                    position_code: position.position_code,
                    name: position.name,
                    recipeIds: [],
                    recipes: [],
                  },
                ],
              }
            : catalogMenu,
        ),
      )
      replaceOrder(orderId, (current) => ({
        ...current,
        needs_review: true,
        status: 'needs_review',
        selected_items: [
          ...current.selected_items,
          {
            sort_order: current.selected_items.length,
            raw_position_text: position.name,
            matched_menu_item_id: position.id,
            matched_recipe_id: null,
            confidence: 1,
            needs_review: true,
            original_text: position.name,
            position_name: position.name,
          },
        ],
      }))
      toast.success('Position angelegt und dem Menü hinzugefügt')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function upload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/product-demand-import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Import fehlgeschlagen')

      setFileName(file.name)
      setJobId(json.jobId)
      setEvents(json.events ?? [])
      setCatalog(json.catalog ?? [])
      toast.success(`${json.events?.length ?? 0} Events für Review importiert`)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function saveReview() {
    if (!jobId) return
    setSaving(true)
    try {
      const orders = events.flatMap((event) =>
        event.orders.map((order) => ({
          id: order.id,
          imported_event_id: order.imported_event_id,
          event_pax: Number(order.event_pax) || 0,
          matched_menu_id: order.matched_menu_id,
          variant_label: order.variant_label,
          variant_item_count: order.variant_item_count,
          selected_items: order.selected_items.map((item, index) => ({
            raw_position_text: item.raw_position_text,
            matched_menu_item_id: item.matched_menu_item_id,
            matched_recipe_id: item.matched_recipe_id,
            confidence: item.confidence,
            needs_review: item.needs_review,
            original_text: item.original_text || item.raw_position_text,
            sort_order: index,
          })),
        })),
      )

      const res = await fetch('/api/product-demand-import', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, orders }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Speichern fehlgeschlagen')
      setEvents(json.events ?? [])
      setCatalog(json.catalog ?? catalog)
      toast.success('Review-Zuordnung gespeichert')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function reload() {
    if (!jobId) return
    try {
      const res = await fetch(`/api/product-demand-import?jobId=${encodeURIComponent(jobId)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Aktualisieren fehlgeschlagen')
      setEvents(json.events ?? [])
      setCatalog(json.catalog ?? [])
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Produktbedarf importieren"
        description="MouseClick-CSV in Events, verkaufte Menüs, Varianten und tatsächlich gewählte Positionen zerlegen."
      />

      <div className="p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileUp className="h-4 w-4" /> MouseClick Produktbedarf
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{uploading ? 'Import läuft...' : 'CSV hochladen'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {fileName ? `Zuletzt: ${fileName}` : 'Produktbedarf_*.csv'}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) upload(file)
                }}
              />
            </div>
          </CardContent>
        </Card>

        {events.length > 0 && (
          <>
            <Card>
              <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4">
                <div>
                  <p className="text-xs text-muted-foreground">Events</p>
                  <p className="text-2xl font-semibold">{events.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Verkaufte Menüs</p>
                  <p className="text-2xl font-semibold">{summary.orderCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gewählte Positionen</p>
                  <p className="text-2xl font-semibold">{summary.selectedCount}</p>
                </div>
                <div>
                  <p className="text-xs text-amber-600">Review offen</p>
                  <p className="text-2xl font-semibold text-amber-600">{summary.review.orders + summary.review.items}</p>
                </div>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" onClick={reload} disabled={!jobId || saving}>
                    <RefreshCw className="h-4 w-4" /> Aktualisieren
                  </Button>
                  <Button onClick={saveReview} disabled={!jobId || saving}>
                    <Save className="h-4 w-4" /> {saving ? 'Speichert...' : 'Zuordnung speichern'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {events.map((event) => (
                <Card key={event.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {event.status === 'reviewed' || event.status === 'matched' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                          {event.event_name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.pax_count} pax · {event.orders.length} Menüpositionen
                        </p>
                      </div>
                      {statusBadge(event.status)}
                    </div>
                    {event.warnings.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {event.warnings.map((warning) => (
                          <Badge key={warning} variant="warning" className="text-[10px]">
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {event.orders.map((order) => {
                      const menu = order.matched_menu_id ? menuById.get(order.matched_menu_id) : null
                      return (
                        <div key={order.id} className="space-y-3 border-t first:border-t-0 pt-5 first:pt-0">
                          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_10rem_8rem]">
                            <div>
                              <p className="text-xs text-muted-foreground">Produkt</p>
                              <p className="text-sm font-medium">{order.product_name}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2" title={order.long_description}>
                                {order.long_description}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Menü</p>
                              <Select value={order.matched_menu_id ?? NO_MENU} onValueChange={(value) => setOrderMenu(order.id, value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Menü wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_MENU}>Prüfen</SelectItem>
                                  {catalog.map((catalogMenu) => (
                                    <SelectItem key={catalogMenu.id} value={catalogMenu.id}>
                                      {catalogMenu.menu_name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Variante</p>
                              <Input
                                value={order.variant_label ?? ''}
                                onChange={(event) => setOrderField(order.id, { variant_label: event.target.value || null })}
                              />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Pax</p>
                              <Input
                                type="number"
                                min={0}
                                value={order.event_pax}
                                onChange={(event) => setOrderField(order.id, { event_pax: Number(event.target.value) || 0 })}
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              className="w-32"
                              value={order.variant_item_count ?? ''}
                              placeholder="Anzahl"
                              onChange={(event) => {
                                const value = Number(event.target.value)
                                setOrderField(order.id, { variant_item_count: Number.isFinite(value) && value > 0 ? value : null })
                              }}
                            />
                            {order.warnings.map((warning) => (
                              <Badge key={warning} variant="warning" className="text-[10px]">
                                {warning}
                              </Badge>
                            ))}
                            <Button variant="outline" size="sm" className="ml-auto" onClick={() => addItem(order.id)}>
                              <Plus className="h-4 w-4" /> Position
                            </Button>
                            <Button variant="outline" size="sm" disabled={!menu} onClick={() => createPositionForOrder(order.id)}>
                              <Plus className="h-4 w-4" /> Neu
                            </Button>
                          </div>

                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="min-w-[18rem]">Gewählte Position</TableHead>
                                  <TableHead className="min-w-[14rem]">Rohtext</TableHead>
                                  <TableHead className="w-28">Confidence</TableHead>
                                  <TableHead className="w-16" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.selected_items.map((item, index) => (
                                  <TableRow key={`${order.id}-${index}`} className={item.needs_review ? 'bg-amber-50/50 dark:bg-amber-950/20' : undefined}>
                                    <TableCell>
                                      <Select
                                        value={item.matched_menu_item_id ?? NO_POSITION}
                                        onValueChange={(value) => selectPosition(order.id, index, value)}
                                        disabled={!menu}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Position wählen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value={NO_POSITION}>Nicht erkannt</SelectItem>
                                          {(menu?.positions ?? []).map((position) => (
                                            <SelectItem key={position.id} value={position.id}>
                                              {position.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={item.raw_position_text}
                                        onChange={(event) => setItem(order.id, index, { raw_position_text: event.target.value, original_text: event.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={item.needs_review ? 'warning' : 'secondary'} className="text-[10px]">
                                        {Math.round((item.confidence ?? 0) * 100)} %
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="icon" onClick={() => removeItem(order.id, index)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
