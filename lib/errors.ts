import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Extracts a human-readable message from any thrown value — Error,
 * Supabase PostgrestError ({ message, details, hint, code }), string, etc.
 * Prevents toasts from showing the useless "[object Object]".
 */
export function getErrorMessage(e: unknown): string {
  if (e == null) return 'Unknown error'
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message
  if (typeof e === 'object') {
    const pg = e as Partial<PostgrestError>
    const parts = [pg.message, pg.details, pg.hint].filter(Boolean)
    if (parts.length) return parts.join(' — ')
    try { return JSON.stringify(e) } catch { return String(e) }
  }
  return String(e)
}
