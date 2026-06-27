import { supabase } from '@/lib/supabase/client'
import { resolveSupplierLabel } from '@/lib/supplier-label'
import { articleName, classifyArticle, cleanIngredientName, type MatchableIngredient } from '@/lib/supplier-matching/matchEngine'
import type {
  IngredientSupplierArticleJoined,
  IngredientSupplierArticleWithIngredient,
  Ingredient,
  Supplier,
} from '@/types'

/** Ergebnis eines Auto-Zuordnungslaufs (Lieferantenartikel → Zutat). */
export type AutoAssignSummary = {
  processedArticles: number
  linked: number
  review: number
  createdIngredients: number
  skippedNonFood: number
}

export type ManualArticleInput = {
  supplierId: string
  name: string
  ekPerBaseUnit: number
  baseUnit: string
  articleNumber?: string | null
  taxRatePercent?: number | null
  preferred: boolean
}

/** Eine Zutat mit allen Lieferantenartikel-Kandidaten (für die zentrale Zuordnung). */
export type IngredientCandidates = {
  ingredient: Pick<Ingredient, 'id' | 'ingredient_code' | 'name' | 'category'>
  mappings: IngredientSupplierArticleJoined[]
  preferred: IngredientSupplierArticleJoined | null
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

  /**
   * Alle Zutaten mit ihren Lieferantenartikel-Kandidaten, gruppiert — für die
   * zentrale Zuordnungs-Übersicht. Ein Query, danach client-seitig gruppiert.
   */
  async listAllCandidates(): Promise<IngredientCandidates[]> {
    const { data, error } = await supabase
      .from('ingredient_supplier_articles')
      .select(`
        *,
        ingredient:ingredients(id, ingredient_code, name, category),
        supplier_article:supplier_articles!ingredient_supplier_articles_supplier_article_id_fkey(
          *,
          supplier:suppliers!supplier_articles_supplier_id_fkey(id, name)
        )
      `)
      .order('is_preferred', { ascending: false })
      .order('needs_review', { ascending: true })
      .order('match_score', { ascending: false })

    if (error) throw error

    const groups = new Map<string, IngredientCandidates>()
    for (const raw of (data ?? []) as unknown as IngredientSupplierArticleWithIngredient[]) {
      const ing = raw.ingredient
      if (!ing) continue
      let g = groups.get(ing.id)
      if (!g) {
        g = { ingredient: ing, mappings: [], preferred: null }
        groups.set(ing.id, g)
      }
      g.mappings.push(raw)
      if (raw.is_preferred) g.preferred = raw
    }

    return [...groups.values()].sort((a, b) =>
      a.ingredient.name.localeCompare(b.ingredient.name, 'de'),
    )
  },

  /** Hebt die Vorzugszuordnung einer Zutat auf (kein bevorzugter Lieferant mehr). */
  async clearPreferred(ingredientId: string): Promise<void> {
    const { error } = await supabase
      .from('ingredient_supplier_articles')
      .update({ is_preferred: false })
      .eq('ingredient_id', ingredientId)
      .eq('is_preferred', true)
    if (error) throw error
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

  /**
   * Auto-Zuordnung (Teil 8): ordnet alle noch nicht zugeordneten, aktiven
   * Lebensmittel-Lieferantenartikel den Zutaten zu.
   *   • genau ein klarer Treffer  → Mapping (kein Review)
   *   • mehrere plausible Treffer → Mapping auf den besten, als Review markiert
   *   • kein Treffer              → neue Zutat anlegen + Mapping
   * Ein Artikel erhält genau EIN Mapping (gehört genau einer Zutat). Bereits
   * zugeordnete Artikel werden übersprungen; der Lauf ist damit idempotent.
   * Nicht-Lebensmittel (is_food=false) werden nicht zu Zutaten gemacht.
   */
  async autoAssignUnmapped(): Promise<AutoAssignSummary> {
    const [{ data: ings, error: ingErr }, { data: mapped, error: mapErr }, { data: articles, error: artErr }] =
      await Promise.all([
        supabase.from('ingredients').select('id, name, ingredient_code'),
        supabase.from('ingredient_supplier_articles').select('supplier_article_id'),
        supabase
          .from('supplier_articles')
          .select('id, clean_article_name_de, ingredient_name_de, raw_article_name, is_food, is_active')
          .eq('is_active', true),
      ])
    if (ingErr) throw ingErr
    if (mapErr) throw mapErr
    if (artErr) throw artErr

    const mappedIds = new Set((mapped ?? []).map((m) => m.supplier_article_id))
    const codes = new Set((ings ?? []).map((i) => i.ingredient_code))
    const ingredients: MatchableIngredient[] = (ings ?? []).map((i) => ({ id: i.id, name: i.name }))

    const summary: AutoAssignSummary = { processedArticles: 0, linked: 0, review: 0, createdIngredients: 0, skippedNonFood: 0 }

    const makeCode = (name: string): string => {
      const slug = name.toUpperCase().normalize('NFD').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'ARTIKEL'
      let code = `ZUT-${slug}`
      let n = 2
      while (codes.has(code)) { code = `ZUT-${slug}-${n++}` }
      codes.add(code)
      return code
    }

    for (const a of articles ?? []) {
      if (mappedIds.has(a.id)) continue // ein Artikel = genau eine Zutat
      if (a.is_food === false) { summary.skippedNonFood++; continue }

      const name = articleName(a)
      summary.processedArticles++
      const decision = classifyArticle(name, ingredients)

      let ingredientId = decision.ingredientId
      let matchType = decision.matchType
      let matchScore = decision.score
      let needsReview = decision.decision === 'review'

      if (decision.decision === 'create' || !ingredientId) {
        const newName = cleanIngredientName(name) || 'Unbenannter Lieferantenartikel'
        const { data: created, error: cErr } = await supabase
          .from('ingredients')
          .insert({
            ingredient_code: makeCode(newName),
            name: newName,
            category: 'Lieferanten-Import (auto)',
            default_unit_id: null,
            supplier_name: null,
            allergens: [],
            notes: 'Automatisch aus Lieferantenartikel angelegt (Matching ohne Zutaten-Treffer). Kategorie/Einheit/Allergene prüfen.',
          })
          .select('id, name')
          .single()
        if (cErr) throw cErr
        ingredientId = created.id
        matchType = 'exakt'
        matchScore = 100
        needsReview = false
        ingredients.push({ id: created.id, name: created.name }) // im Lauf wiederverwendbar
        summary.createdIngredients++
      }

      const { error: linkErr } = await supabase
        .from('ingredient_supplier_articles')
        .insert({
          ingredient_id: ingredientId,
          supplier_article_id: a.id,
          match_type: matchType,
          match_score: matchScore,
          is_preferred: false,
          needs_review: needsReview,
          review_reason: needsReview ? (decision.reason ?? 'Mehrdeutiger Treffer — bitte bestätigen') : null,
          priority: 100,
        })
      if (linkErr) throw linkErr

      mappedIds.add(a.id)
      if (needsReview) summary.review++
      else summary.linked++
    }

    return summary
  },
}
