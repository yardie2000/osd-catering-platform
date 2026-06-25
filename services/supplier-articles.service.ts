import { supabase } from '@/lib/supabase/client'
import { resolveSupplierLabel } from '@/lib/supplier-label'
import type { IngredientSupplierArticleJoined, Supplier } from '@/types'

export type ManualArticleInput = {
  supplierId: string
  name: string
  ekPerBaseUnit: number
  baseUnit: string
  articleNumber?: string | null
  taxRatePercent?: number | null
  preferred: boolean
}

export const supplierArticlesService = {
  /** Alle Lieferantenartikel-Zuordnungen (EK) einer Zutat, inkl. Artikel + Lieferant. */
  async getByIngredientId(ingredientId: string): Promise<IngredientSupplierArticleJoined[]> {
    const { data, error } = await supabase
      .from('ingredient_supplier_articles')
      .select(`
        *,
        supplier_article:supplier_articles!ingredient_supplier_articles_supplier_article_id_fkey(
          *,
          supplier:suppliers!supplier_articles_supplier_id_fkey(id, name)
        )
      `)
      .eq('ingredient_id', ingredientId)
      .order('is_preferred', { ascending: false })
      .order('needs_review', { ascending: true })
      .order('match_score', { ascending: false })

    if (error) throw error

    return (data ?? []) as unknown as IngredientSupplierArticleJoined[]
  },

  /** Aktive Lieferanten für das Auswahlfeld. */
  async listSuppliers(): Promise<Pick<Supplier, 'id' | 'name'>[]> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true })

    if (error) throw error
    return (data ?? []) as Pick<Supplier, 'id' | 'name'>[]
  },

  /** Bevorzugter EK-Lieferant je Zutat (für die Listenspalte). */
  async listPreferredSuppliers(): Promise<{ ingredient_id: string; label: string }[]> {
    const { data, error } = await supabase
      .from('ingredient_supplier_articles')
      .select(`
        ingredient_id,
        supplier_article:supplier_articles!ingredient_supplier_articles_supplier_article_id_fkey(
          match_key,
          supplier:suppliers!supplier_articles_supplier_id_fkey(name)
        )
      `)
      .eq('is_preferred', true)

    if (error) throw error

    return (data ?? []).map((r) => {
      const a = (r as { supplier_article?: { match_key?: string | null; supplier?: { name?: string | null } | null } | null }).supplier_article
      return {
        ingredient_id: (r as { ingredient_id: string }).ingredient_id,
        label: resolveSupplierLabel(a?.supplier?.name, a?.match_key),
      }
    })
  },

  /** Setzt eine Zuordnung als bevorzugt (und hebt die bisherige auf); bestätigt sie zugleich. */
  async setPreferred(ingredientId: string, mappingId: string): Promise<void> {
    const { error: unsetErr } = await supabase
      .from('ingredient_supplier_articles')
      .update({ is_preferred: false })
      .eq('ingredient_id', ingredientId)
      .eq('is_preferred', true)
    if (unsetErr) throw unsetErr

    const { error } = await supabase
      .from('ingredient_supplier_articles')
      .update({ is_preferred: true, needs_review: false })
      .eq('id', mappingId)
    if (error) throw error
  },

  /** Entfernt eine Zuordnung (Zutat ↔ Artikel). Der Artikel selbst bleibt erhalten. */
  async removeMapping(mappingId: string): Promise<void> {
    const { error } = await supabase
      .from('ingredient_supplier_articles')
      .delete()
      .eq('id', mappingId)
    if (error) throw error
  },

  /** Legt einen neuen Lieferanten an (benötigt anon-Insert-Policy auf suppliers). */
  async createSupplier(name: string): Promise<Pick<Supplier, 'id' | 'name'>> {
    const code = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'lieferant'
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ supplier_code: code, name: name.trim(), active: true })
      .select('id, name')
      .single()
    if (error) throw error
    return data as Pick<Supplier, 'id' | 'name'>
  },

  /**
   * Legt manuell einen Lieferantenartikel an und verknüpft ihn mit der Zutat.
   * EK-only; match_key bleibt null. Bei preferred wird die bisherige
   * Vorzugszuordnung der Zutat zurückgesetzt (Partial-Unique-Index).
   */
  async addManualArticle(ingredientId: string, input: ManualArticleInput): Promise<void> {
    const { data: article, error: artErr } = await supabase
      .from('supplier_articles')
      .insert({
        supplier_id: input.supplierId,
        clean_article_name_de: input.name,
        raw_article_name: input.name,
        base_unit: input.baseUnit,
        ek_price_per_base_unit: input.ekPerBaseUnit,
        currency: 'EUR',
        is_food: true,
        is_active: true,
        supplier_article_number: input.articleNumber || null,
        tax_rate_percent: input.taxRatePercent ?? null,
        match_key: null,
      })
      .select('id')
      .single()

    if (artErr) throw artErr

    if (input.preferred) {
      const { error: unsetErr } = await supabase
        .from('ingredient_supplier_articles')
        .update({ is_preferred: false })
        .eq('ingredient_id', ingredientId)
        .eq('is_preferred', true)
      if (unsetErr) throw unsetErr
    }

    const { error: linkErr } = await supabase
      .from('ingredient_supplier_articles')
      .insert({
        ingredient_id: ingredientId,
        supplier_article_id: (article as { id: string }).id,
        match_type: 'manuell',
        match_score: 100,
        is_preferred: input.preferred,
        needs_review: false,
        priority: 100,
      })

    if (linkErr) throw linkErr
  },
}
