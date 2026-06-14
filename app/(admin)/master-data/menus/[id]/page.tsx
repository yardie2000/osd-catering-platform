'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import {
  useMenu,
  useUpdateMenu,
  useAddMenuItem,
  useRemoveMenuItem,
  useSetMenuItemRecipe,
  useReorderMenuItems,
} from '@/hooks/use-menus'
import { MenuRecipePicker } from '@/components/master-data/menus/menu-recipe-picker'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Pencil, Trash2, Plus, Link2, Replace, Unlink, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { MENU_CATEGORIES, type Recipe } from '@/types'

const editSchema = z.object({
  menu_code:        z.string().min(1, 'Pflichtfeld'),
  menu_name:        z.string().min(1, 'Pflichtfeld'),
  menu_description: z.string().optional().nullable(),
  category:         z.string().optional(),
  price_per_person: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().optional().nullable()),
  active:           z.boolean().default(true),
})
type EditValues = z.infer<typeof editSchema>

export default function MenuDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: menu, isLoading } = useMenu(id)
  const updateMenu    = useUpdateMenu()
  const addItem       = useAddMenuItem(id)
  const removeItem    = useRemoveMenuItem(id)
  const setItemRecipe = useSetMenuItemRecipe(id)
  const reorderItems  = useReorderMenuItems(id)

  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen]   = useState(false)
  const [newItem, setNewItem]   = useState({ name: '', description: '', dietary: '', item_price: '' })
  const [newRecipe, setNewRecipe] = useState<Recipe | null>(null)

  // Recipe picker state: which existing menu line we're linking (id), and
  // a separate flag for the picker inside the "add item" dialog.
  const [linkItemId, setLinkItemId]   = useState<string | null>(null)
  const [addPickerOpen, setAddPickerOpen] = useState(false)

  const linkItem = menu?.menu_items.find((m) => m.id === linkItemId) ?? null

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  function openEdit() {
    if (!menu) return
    reset({
      menu_code:        menu.menu_code,
      menu_name:        menu.menu_name,
      menu_description: menu.menu_description ?? undefined,
      category:         menu.category ?? undefined,
      price_per_person: menu.price_per_person ?? undefined,
      active:           menu.active,
    })
    setEditOpen(true)
  }

  async function handleSave(values: EditValues) {
    try {
      await updateMenu.mutateAsync({ id, payload: {
        menu_code:        values.menu_code,
        menu_name:        values.menu_name,
        menu_description: values.menu_description ?? null,
        category:         values.category ?? null,
        price_per_person: values.price_per_person ?? null,
        active:           values.active,
      }})
      toast.success('Menü aktualisiert')
      setEditOpen(false)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  function resetAddForm() {
    setNewItem({ name: '', description: '', dietary: '', item_price: '' })
    setNewRecipe(null)
  }

  async function handleAddItem() {
    if (!newItem.name.trim()) { toast.error('Name der Position ist erforderlich'); return }
    const sortOrder = menu?.menu_items.length ?? 0
    try {
      await addItem.mutateAsync({
        item: {
          name:        newItem.name.trim(),
          description: newItem.description.trim() || null,
          dietary:     newItem.dietary.trim() || null,
          item_price:  newItem.item_price ? Number(newItem.item_price) : null,
          recipe_id:   newRecipe?.id ?? null,
        },
        sortOrder,
      })
      toast.success('Position hinzugefügt')
      setAddOpen(false)
      resetAddForm()
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleRemoveItem(menuItemId: string, itemName: string) {
    if (!confirm(`„${itemName}" aus diesem Menü entfernen?`)) return
    try {
      await removeItem.mutateAsync(menuItemId)
      toast.success('Position entfernt')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  // Link / change the recipe of the menu line currently held in linkItemId.
  async function handleLinkRecipe(recipe: Recipe) {
    if (!linkItemId) return
    try {
      await setItemRecipe.mutateAsync({ menuItemId: linkItemId, recipeId: recipe.id })
      toast.success(`Mit ${recipe.name} verknüpft`)
    } catch (e) { toast.error(getErrorMessage(e)) }
    setLinkItemId(null)
  }

  async function handleUnlinkRecipe(menuItemId: string) {
    try {
      await setItemRecipe.mutateAsync({ menuItemId, recipeId: null })
      toast.success('Rezeptverknüpfung entfernt')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    if (!menu) return
    const items = menu.menu_items
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    try {
      await reorderItems.mutateAsync(next.map((it, i) => ({ id: it.id, sort_order: i })))
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Laden…</div>
  if (!menu)     return <div className="flex items-center justify-center h-full text-muted-foreground">Menü nicht gefunden.</div>

  const itemCount = menu.menu_items.length
  const linkedCount = menu.menu_items.filter((m) => m.recipe_id).length

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={menu.menu_name}
        description={`${menu.menu_code} · ${itemCount} Position(en) · ${linkedCount}/${itemCount} mit Rezept verknüpft`}
        actions={
          <div className="flex gap-2">
            <Link href="/master-data/menus">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
            </Link>
            <Button size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4" /> Bearbeiten
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <div className="flex gap-3 flex-wrap">
          {menu.active ? <Badge variant="success">Aktiv</Badge> : <Badge variant="secondary">Inaktiv</Badge>}
          {menu.category && <Badge variant="outline">{menu.category}</Badge>}
          {menu.price_per_person != null && <Badge variant="outline">{menu.price_per_person} €/Person</Badge>}
        </div>

        {menu.menu_description && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Beschreibung</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{menu.menu_description}</p></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Positionen in diesem Menü</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Position hinzufügen
            </Button>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Rezept</TableHead>
                  <TableHead>Ernährung</TableHead>
                  <TableHead>Allergene</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead className="w-28 text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemCount === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <div className="space-y-3">
                        <p>Dieses Menü hat noch keine Positionen. Füge Gerichte oder Gänge hinzu, damit es in der Produktion nutzbar ist.</p>
                        <Button size="sm" onClick={() => setAddOpen(true)}>
                          <Plus className="h-4 w-4" /> Erste Position hinzufügen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  menu.menu_items.map((mi, i) => (
                    <TableRow key={mi.id}>
                      <TableCell className="text-muted-foreground text-sm">{i + 1}</TableCell>
                      <TableCell className="font-medium align-top">
                        {mi.recipe ? (
                          <Link href={`/master-data/recipes/${mi.recipe.id}`} className="font-medium text-primary hover:underline">
                            {mi.name}
                          </Link>
                        ) : (
                          mi.name
                        )}
                        {mi.description && (
                          <p className="text-xs text-muted-foreground font-normal">{mi.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {mi.recipe ? (
                          <div className="space-y-2">
                            <div className="flex flex-col">
                              <Link
                                href={`/master-data/recipes/${mi.recipe.id}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {mi.recipe.name}
                              </Link>
                              <span className="font-mono text-xs text-muted-foreground">{mi.recipe.recipe_code}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => setLinkItemId(mi.id)}>
                                <Replace className="h-3.5 w-3.5" /> Ändern
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleUnlinkRecipe(mi.id)}
                                disabled={setItemRecipe.isPending}
                              >
                                <Unlink className="h-3.5 w-3.5" /> Trennen
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Badge variant="outline">Kein Rezept verknüpft</Badge>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="secondary" onClick={() => setLinkItemId(mi.id)}>
                                <Link2 className="h-3.5 w-3.5" /> Rezept verknüpfen
                              </Button>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/master-data/recipes/new?name=${encodeURIComponent(mi.name)}`}>Rezept anlegen</Link>
                              </Button>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        {mi.dietary ? <Badge variant="outline">{mi.dietary}</Badge> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="align-top">
                        {mi.allergens && mi.allergens.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {mi.allergens.map((a) => (
                              <Badge key={a} variant="warning" className="text-[10px] px-1.5">{a}</Badge>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top">
                        {mi.item_price != null ? `${mi.item_price} €` : '—'}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleMove(i, -1)}
                            disabled={i === 0 || reorderItems.isPending}
                            aria-label="Nach oben"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleMove(i, 1)}
                            disabled={i === itemCount - 1 || reorderItems.isPending}
                            aria-label="Nach unten"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleRemoveItem(mi.id, mi.name)}
                            aria-label="Position entfernen"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit metadata dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Menü bearbeiten</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(handleSave)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Menücode *</label>
                <Input {...register('menu_code')} className="mt-1" />
                {errors.menu_code && <p className="text-xs text-destructive mt-1">{errors.menu_code.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Kategorie</label>
                <Controller control={control} name="category" render={({ field }) => (
                  <Select value={field.value ?? '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Wählen…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Keine</SelectItem>
                      {MENU_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input {...register('menu_name')} className="mt-1" />
              {errors.menu_name && <p className="text-xs text-destructive mt-1">{errors.menu_name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Beschreibung</label>
              <Textarea {...register('menu_description')} className="mt-1" rows={3} placeholder="Optionale Beschreibung" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Preis pro Person (€)</label>
                <Input {...register('price_per_person')} type="number" step="0.01" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Optionales Preisfeld für Menüplanung und Anzeige.</p>
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="active-edit" {...register('active')} />
                  <label htmlFor="active-edit" className="text-sm">Aktiv</label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Abbrechen</Button>
              <Button type="submit" disabled={updateMenu.isPending}>{updateMenu.isPending ? 'Speichern…' : 'Speichern'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAddForm() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Position zum Menü hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem((s) => ({ ...s, name: e.target.value }))}
                placeholder="z. B. Tomatensuppe"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Name der Position, wie er in Menüs und Bestellübersichten erscheint.</p>
            </div>

            {/* Optionale Rezeptverknüpfung */}
            <div>
              <label className="text-sm font-medium">Rezept (optional)</label>
              {newRecipe ? (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{newRecipe.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{newRecipe.recipe_code}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setAddPickerOpen(true)}>
                      <Replace className="h-3.5 w-3.5" /> Ändern
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setNewRecipe(null)}>
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button type="button" variant="secondary" className="mt-1 w-full" onClick={() => setAddPickerOpen(true)}>
                  <Link2 className="h-4 w-4" /> Rezept verknüpfen
                </Button>
              )}
              <p className="text-xs text-muted-foreground mt-1">Verknüpfe diese Zeile mit einem Rezept für Produktionsskalierung und Einkauf.</p>
            </div>

            <div>
              <label className="text-sm font-medium">Beschreibung</label>
              <Input
                value={newItem.description}
                onChange={(e) => setNewItem((s) => ({ ...s, description: e.target.value }))}
                placeholder="Optionale Beschreibung"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Ernährung</label>
                <Input
                  value={newItem.dietary}
                  onChange={(e) => setNewItem((s) => ({ ...s, dietary: e.target.value }))}
                  placeholder="z. B. vegan"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Optionales Ernährungskennzeichen für diese Menüposition.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Preis (€)</label>
                <Input
                  value={newItem.item_price}
                  onChange={(e) => setNewItem((s) => ({ ...s, item_price: e.target.value }))}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Optionaler Positionspreis für diese Menüzeile.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Abbrechen</Button>
            <Button type="button" onClick={handleAddItem} disabled={addItem.isPending}>
              {addItem.isPending ? 'Wird hinzugefügt…' : 'Position hinzufügen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recipe picker for an existing menu line */}
      <MenuRecipePicker
        open={linkItemId !== null}
        onOpenChange={(o) => { if (!o) setLinkItemId(null) }}
        onSelect={handleLinkRecipe}
        selectedRecipeId={linkItem?.recipe_id ?? null}
        title={linkItem?.recipe ? 'Rezept ändern' : 'Rezept verknüpfen'}
      />

      {/* Recipe picker for the add-item dialog */}
      <MenuRecipePicker
        open={addPickerOpen}
        onOpenChange={setAddPickerOpen}
        onSelect={(recipe) => {
          setNewRecipe(recipe)
          setNewItem((s) => ({ ...s, name: s.name.trim() ? s.name : recipe.name }))
          setAddPickerOpen(false)
        }}
        selectedRecipeId={newRecipe?.id ?? null}
      />
    </div>
  )
}
