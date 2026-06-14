import { supabase } from '@/lib/supabase/client'
import type { Unit, UnitInsert, UnitUpdate } from '@/types'

type UnitListOptions = {
  search?: string
  base_unit?: string
}

export const unitsService = {
  async getAll(options?: UnitListOptions): Promise<Unit[]> {
    let query = supabase
      .from('units')
      .select('*')
      .order('name', { ascending: true })

    if (options?.search?.trim()) {
      const search = options.search.trim()
      query = query.or(`name.ilike.%${search}%,unit_code.ilike.%${search}%,short_name.ilike.%${search}%`)
    }

    if (options?.base_unit?.trim()) {
      query = query.eq('base_unit', options.base_unit.trim())
    }

    const { data, error } = await query
    if (error) throw error

    return (data ?? []) as Unit[]
  },

  async getById(id: string): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    return data as Unit
  },

  async getByCode(code: string): Promise<Unit | null> {
    const { data, error } = await supabase
      .from('units')
      .select('*')
      .eq('unit_code', code)
      .maybeSingle()

    if (error) throw error

    return data as Unit | null
  },

  async create(payload: UnitInsert): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return data as Unit
  },

  async update(id: string, payload: UnitUpdate): Promise<Unit> {
    const { data, error } = await supabase
      .from('units')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return data as Unit
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getBaseUnits(): Promise<string[]> {
    const { data, error } = await supabase
      .from('units')
      .select('base_unit')
      .not('base_unit', 'is', null)

    if (error) throw error

    const unique = new Set<string>()

    ;(data ?? []).forEach((row) => {
      const baseUnit = row.base_unit?.trim()
      if (baseUnit) unique.add(baseUnit)
    })

    return [...unique].sort((a, b) => a.localeCompare(b, 'de'))
  },
}