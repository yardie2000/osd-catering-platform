import { supabase } from '@/lib/supabase/client'
import type { IngredientSupplierArticleJoined } from '@/types'

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
}
