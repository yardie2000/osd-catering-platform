'use client'

import { useState } from 'react'
import { useMenus, useMenuCategories, useCreateMenu, useUpdateMenu, useDeleteMenu } from '@/hooks/use-menus'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Search, Eye, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import type { Menu } from '@/types'
import { MENU_CATEGORIES } from '@/types'

const schema = z.object({
  menu_code:        z.string().min(1, 'Required'),
  menu_name:        z.string().min(1, 'Required'),
  menu_description: z.string().optional().nullable(),
  category:         z.string().optional(),
  price_per_person: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().optional().nullable()),
  active:           z.boolean().default(true),
})
type FormValues = z.infer<typeof schema>

function MenuForm({ defaultValues, onSubmit, onCancel, loading }: {
  defaultValues?: Partial<FormValues>
  onSubmit: (v: FormValues) => void
  onCancel?: () => void
  loading: boolean
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { active: true, ...defaultValues },
  })
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Menu Code *</label>
          <Input {...register('menu_code')} placeholder="MENU_001" className="mt-1" />
          {errors.menu_code && <p className="text-xs text-destructive mt-1">{errors.menu_code.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Category</label>
          <Controller control={control} name="category" render={({ field }) => (
            <Select value={field.value ?? '__none__'} onValueChange={(v) => field.onChange(v === '__none__' ? undefined : v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {MENU_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Name *</label>
        <Input {...register('menu_name')} placeholder="Menu name" className="mt-1" />
        {errors.menu_name && <p className="text-xs text-destructive mt-1">{errors.menu_name.message}</p>}
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea {...register('menu_description')} placeholder="Optional description" rows={3} className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Price per Person (€)</label>
          <Input {...register('price_per_person')} type="number" step="0.01" placeholder="0.00" className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">Optional pricing field for menu planning and display.</p>
        </div>
        <div className="flex items-end pb-1">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" {...register('active')} />
            <label htmlFor="active" className="text-sm">Active</label>
          </div>
        </div>
      </div>
      <DialogFooter>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
      </DialogFooter>
    </form>
  )
}

export default function MenusPage() {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('__all__')
  const [dialog, setDialog] = useState<'create' | { edit: Menu } | null>(null)

  const { data: menus = [], isLoading } = useMenus({ search, category: categoryFilter === '__all__' ? undefined : categoryFilter })
  const { data: categories = [] } = useMenuCategories()
  const createMenu = useCreateMenu()
  const updateMenu = useUpdateMenu()
  const deleteMenu = useDeleteMenu()

  async function handleCreate(values: FormValues) {
    try {
      await createMenu.mutateAsync({
        menu_code:        values.menu_code,
        menu_name:        values.menu_name,
        menu_description: values.menu_description ?? null,
        category:         values.category ?? null,
        price_per_person: values.price_per_person ?? null,
        active:           values.active,
      })
      toast.success('Menu created')
      setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleEdit(id: string, values: FormValues) {
    try {
      await updateMenu.mutateAsync({ id, payload: {
        menu_code:        values.menu_code,
        menu_name:        values.menu_name,
        menu_description: values.menu_description ?? null,
        category:         values.category ?? null,
        price_per_person: values.price_per_person ?? null,
        active:           values.active,
      }})
      toast.success('Menu updated')
      setDialog(null)
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete menu "${name}"?`)) return
    try {
      await deleteMenu.mutateAsync(id)
      toast.success('Menu deleted')
    } catch (e) { toast.error(getErrorMessage(e)) }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Menus"
        description="Menu management — recipe assignments, categories, active state"
        actions={
          <Button onClick={() => setDialog('create')} size="sm">
            <Plus className="h-4 w-4" /> New Menu
          </Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search menus…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : menus.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <div className="space-y-3">
                        <p>No menus found. Create your first menu to start building the workflow.</p>
                        <Button size="sm" onClick={() => setDialog('create')}>
                          <Plus className="h-4 w-4" /> Create Menu
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  menus.map((menu) => (
                    <TableRow key={menu.id}>
                              <TableCell><Badge variant="outline">{menu.menu_code}</Badge></TableCell>
                      <TableCell className="font-medium">
                        <div>{menu.menu_name}</div>
                        {menu.menu_description && (
                          <div className="text-xs text-muted-foreground mt-1 max-w-[24rem] overflow-hidden text-ellipsis whitespace-nowrap">
                            {menu.menu_description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{menu.category ?? '—'}</TableCell>
                      <TableCell>
                        {menu.active ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Link href={`/master-data/menus/${menu.id}`}>
                            <Button variant="ghost" size="icon"><Eye className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <Button variant="ghost" size="icon" onClick={() => setDialog({ edit: menu })}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(menu.id, menu.menu_name)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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

      <Dialog open={dialog === 'create'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent><DialogHeader><DialogTitle>New Menu</DialogTitle></DialogHeader>
          <MenuForm onSubmit={handleCreate} onCancel={() => setDialog(null)} loading={createMenu.isPending} />
        </DialogContent>
      </Dialog>
      {dialog && typeof dialog === 'object' && 'edit' in dialog && (
        <Dialog open onOpenChange={(o) => !o && setDialog(null)}>
          <DialogContent><DialogHeader><DialogTitle>Edit Menu</DialogTitle></DialogHeader>
            <MenuForm
              defaultValues={{
                menu_code:        dialog.edit.menu_code,
                menu_name:        dialog.edit.menu_name,
                menu_description: dialog.edit.menu_description ?? undefined,
                category:         dialog.edit.category ?? undefined,
                price_per_person: dialog.edit.price_per_person ?? undefined,
                active:           dialog.edit.active,
              }}
              onSubmit={(v) => handleEdit(dialog.edit.id, v)}
              onCancel={() => setDialog(null)}
              loading={updateMenu.isPending}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
