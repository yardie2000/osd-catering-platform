'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useMenu, useUpdateMenu } from '@/hooks/use-menus'
import { getErrorMessage } from '@/lib/errors'
import { MenuPositionsManager } from '@/components/master-data/menus/menu-positions-manager'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MENU_CATEGORIES } from '@/types'

const editSchema = z.object({
  menu_code:        z.string().min(1, 'Pflichtfeld'),
  menu_name:        z.string().min(1, 'Pflichtfeld'),
  menu_description: z.string().optional().nullable(),
  category:         z.string().optional(),
  price_per_person: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().optional().nullable()),
  active:           z.boolean().default(true),
})
type EditValues = z.infer<typeof editSchema>

export default function MenuDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: menu, isLoading } = useMenu(id)
  const updateMenu = useUpdateMenu()
  const [editOpen, setEditOpen] = useState(false)

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

  if (isLoading) return <div className="flex items-center justify-center h-full text-muted-foreground">Laden…</div>
  if (!menu)     return <div className="flex items-center justify-center h-full text-muted-foreground">Menü nicht gefunden.</div>

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={menu.menu_name}
        description={menu.menu_code}
        actions={
          <div className="flex gap-2">
            <Link href="/master-data/menus">
              <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4" /> Zurück</Button>
            </Link>
            <Button size="sm" onClick={openEdit}><Pencil className="h-4 w-4" /> Bearbeiten</Button>
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

        <MenuPositionsManager menuId={id} />
      </div>

      {/* Metadaten bearbeiten */}
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
    </div>
  )
}
