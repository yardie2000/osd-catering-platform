'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { MatchableMenu } from '@/lib/produktbedarf/menuMatcher'

type MatcherContextState = {
  context: MatchableMenu[]
  isLoading: boolean
  error: string | null
}

type RawMatcherComponent = {
  recipe_id: string | null
}

type RawMatcherPosition = {
  id: string
  name: string
  position_code: string | null
  position_components?: RawMatcherComponent[] | null
}

type RawMatcherMenuPosition = {
  position: RawMatcherPosition | null
}

type RawMatcherMenu = {
  id: string
  menu_name: string
  menu_code: string
  menu_positions?: RawMatcherMenuPosition[] | null
}

/**
 * Loads the full menu catalog — including positions and their linked recipe IDs —
 * into the MatchableMenu[] shape expected by matchProdukt().
 *
 * Falls back gracefully when the positions catalog is empty or the tables don't
 * exist yet: menus without positions still participate in Stages 1 & 2 matching.
 */
export function useMatcherContext(): MatcherContextState {
  const [state, setState] = useState<MatcherContextState>({
    context: [],
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Load menus with nested positions and position→recipe links
        const { data, error } = await supabase
          .from('menus')
          .select(
            `
            id,
            menu_name,
            menu_code,
            menu_positions(
              position:positions(
                id,
                name,
                position_code,
                position_components(
                  recipe_id
                )
              )
            )
          `,
          )
          .eq('active', true)
          .order('menu_name')

        if (error) throw error
        if (cancelled) return

        const menus: MatchableMenu[] = ((data ?? []) as unknown as RawMatcherMenu[]).map((row) => ({
          id: row.id,
          menu_name: row.menu_name,
          menu_code: row.menu_code,
          positions: (row.menu_positions ?? [])
            // menu_positions may be an array of { position: Position | null }
            .map((mp) => mp.position)
            .filter((pos): pos is RawMatcherPosition => Boolean(pos))
            .map((pos) => ({
              id: pos.id,
              name: pos.name,
              position_code: pos.position_code ?? null,
              recipeIds: (pos.position_components ?? [])
                .map((component) => component.recipe_id)
                .filter((recipeId): recipeId is string => Boolean(recipeId)),
            })),
        }))

        setState({ context: menus, isLoading: false, error: null })
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setState({ context: [], isLoading: false, error: msg })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
