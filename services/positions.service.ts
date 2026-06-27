import { supabase } from '@/lib/supabase/client'
import type {
  Position, PositionInsert, PositionUpdate, PositionWithComponents, PositionComponentInsert,
} from '@/types'

export type PositionListRow = Position & {
  usageCount: number
  componentCount: number
  recipeCount: number
  ingredientCount: number
}

const COMPONENTS_SELECT = `
  components:position_components(
    id, position_id, recipe_id, ingredient_id, quantity, unit_id, sort_order,
    recipe:recipes(id, recipe_code, name),
    ingredient:ingredients(id, ingredient_code, name),
    unit:units!position_components_unit_id_fkey(id, unit_code, name, short_name)
  )
`

export const positionsService = {
  // List with usage (# menus) + component breakdown (recipe vs. ingredient).
  // Embeds the component target columns so the Produktionsmodus can show
  // Status-Badges (hat Rezept? / hat Zutat? / vollständig?) ohne Detail-Load.
  async getAll(search?: string): Promise<PositionListRow[]> {
    let query = supabase
      .from('positions')
      .select('*, menu_positions(count), position_components(recipe_id, ingredient_id)')
      .order('name', { ascending: true })

    if (search?.trim()) {
      const s = search.trim()
      query = query.or(`name.ilike.%${s}%,position_code.ilike.%${s}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map((p) => {
      const { menu_positions, position_components, ...rest } = p as Position & {
        menu_positions: { count: number }[]
        position_components: { recipe_id: string | null; ingredient_id: string | null }[]
      }
      const components = position_components ?? []
      return {
        ...(rest as Position),
        usageCount: menu_positions?.[0]?.count ?? 0,
        componentCount: components.length,
        recipeCount: components.filter((c) => c.recipe_id != null).length,
        ingredientCount: components.filter((c) => c.ingredient_id != null).length,
      }
    })
  },

  async getById(id: string): Promise<PositionWithComponents> {
    const { data, error } = await supabase
      .from('positions')
      .select(`*, ${COMPONENTS_SELECT}`)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as unknown as PositionWithComponents
  },

  // Generate a sequential POS-#### code when none is supplied.
  async nextCode(): Promise<string> {
    const { count } = await supabase.from('positions').select('*', { count: 'exact', head: true })
    return `POS-${String((count ?? 0) + 1).padStart(4, '0')}`
  },

  async create(payload: PositionInsert): Promise<Position> {
    const position_code = payload.position_code ?? (await positionsService.nextCode())
    const { data, error } = await supabase
      .from('positions')
      .insert({ ...payload, position_code })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, payload: PositionUpdate): Promise<Position> {
    const { data, error } = await supabase.from('positions').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
  },

  // ON DELETE RESTRICT on menu_positions.position_id → throws when still in use.
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('positions').delete().eq('id', id)
    if (error) throw error
  },

  // ── Dubletten zusammenführen ────────────────────────────────
  // Quelle (sourceId) geht in Ziel (targetId) auf und wird gelöscht. menu_id /
  // position_id sind in den Update-Typen bewusst unveränderlich, daher hängen
  // wir per delete+insert um (Insert erlaubt beide Spalten):
  //  1. menu_positions: Quell-Zuordnungen, deren Menü das Ziel noch nicht
  //     nutzt, als neue Ziel-Zuordnungen anlegen (sort_order/price_override
  //     übernommen); alle Quell-Zuordnungen anschließend löschen. Wo das Ziel
  //     im selben Menü schon hängt (UNIQUE menu_id+position_id), entfällt die
  //     Quell-Zuordnung ersatzlos.
  //  2. position_components: Komponenten, die das Ziel (nach recipe/ingredient)
  //     bereits hat, werden nicht übernommen (keine Dopplung); der Rest wird als
  //     neue Ziel-Komponenten hinten angehängt. Die Quell-Komponenten entfernt
  //     der Cascade beim Löschen der Quelle.
  //  3. Quelle löschen.
  async merge(sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) throw new Error('Quelle und Ziel sind identisch')

    // 1) menu_positions
    const [{ data: srcMP }, { data: tgtMP }] = await Promise.all([
      supabase.from('menu_positions').select('id, menu_id, sort_order, price_override').eq('position_id', sourceId),
      supabase.from('menu_positions').select('menu_id').eq('position_id', targetId),
    ])
    const tgtMenuIds = new Set((tgtMP ?? []).map((r) => r.menu_id))
    const mpToMove = (srcMP ?? []).filter((r) => !tgtMenuIds.has(r.menu_id))

    if (mpToMove.length > 0) {
      const { error } = await supabase.from('menu_positions').insert(
        mpToMove.map((r) => ({
          menu_id:        r.menu_id,
          position_id:    targetId,
          sort_order:     r.sort_order,
          price_override: r.price_override,
        }))
      )
      if (error) throw error
    }
    if ((srcMP ?? []).length > 0) {
      const { error } = await supabase.from('menu_positions').delete().eq('position_id', sourceId)
      if (error) throw error
    }

    // 2) position_components — keep target's, append target-unique ones from source.
    const [{ data: tgtComp }, { data: srcComp }] = await Promise.all([
      supabase.from('position_components').select('recipe_id, ingredient_id, sort_order').eq('position_id', targetId),
      supabase.from('position_components').select('recipe_id, ingredient_id, quantity, unit_id').eq('position_id', sourceId),
    ])
    const keyOf = (c: { recipe_id: string | null; ingredient_id: string | null }) => `${c.recipe_id ?? ''}|${c.ingredient_id ?? ''}`
    const tgtKeys = new Set((tgtComp ?? []).map(keyOf))
    const maxSort = (tgtComp ?? []).reduce((m, c) => Math.max(m, c.sort_order ?? 0), -1)
    const toMove = (srcComp ?? []).filter((c) => !tgtKeys.has(keyOf(c)))

    if (toMove.length > 0) {
      const { error } = await supabase.from('position_components').insert(
        toMove.map((c, i) => ({
          position_id:   targetId,
          recipe_id:     c.recipe_id,
          ingredient_id: c.ingredient_id,
          quantity:      c.quantity,
          unit_id:       c.unit_id,
          sort_order:    maxSort + 1 + i,
        }))
      )
      if (error) throw error
    }

    // 3) delete source (cascade removes its components)
    const { error: delError } = await supabase.from('positions').delete().eq('id', sourceId)
    if (delError) throw delError
  },

  // ── Komponenten der Position ────────────────────────────────
  async addComponent(c: PositionComponentInsert): Promise<void> {
    const { error } = await supabase.from('position_components').insert({
      position_id:   c.position_id,
      recipe_id:     c.recipe_id ?? null,
      ingredient_id: c.ingredient_id ?? null,
      quantity:      c.quantity,
      unit_id:       c.unit_id ?? null,
      sort_order:    c.sort_order ?? 0,
    })
    if (error) throw error
  },

  async updateComponent(id: string, patch: { quantity?: number; unit_id?: string | null }): Promise<void> {
    const { error } = await supabase.from('position_components').update(patch).eq('id', id)
    if (error) throw error
  },

  async removeComponent(id: string): Promise<void> {
    const { error } = await supabase.from('position_components').delete().eq('id', id)
    if (error) throw error
  },
}
