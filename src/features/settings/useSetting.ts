// Org-wide app settings, backed by the `app_settings` table (see
// supabase/migrations/20260917170000_app_settings.sql). One row per key with a
// small JSON value, e.g. key 'raffle_tickets_enabled' → {"enabled": true}.
//
// Public screens call useSetting() to decide what to show; it never throws —
// a missing table, missing row, RLS denial or absent Supabase config all
// resolve silently to the fallback. Staff write with setSetting() from the
// /staff/settings screen (RLS gates writes on `settings.manage`).
//
// Only NON-SECRET values belong in this table: every row is publicly readable.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Json } from '../../lib/database.types'

export interface SettingState<T> {
  /** The stored value, or `fallback` while loading / when nothing is stored. */
  value: T
  /** True until the first read settles (so a gated feature never flashes). */
  loading: boolean
}

// Read one setting. The public app has no org context, so this reads the first
// row for the key (the app serves one organisation). Returns the fallback
// silently on any error.
export function useSetting<T extends Json>(key: string, fallback: T): SettingState<T> {
  const [state, setState] = useState<SettingState<T>>({ value: fallback, loading: isSupabaseConfigured })

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState({ value: fallback, loading: false })
      return
    }
    let active = true
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        const stored = !error && data ? (data.value as T | null) : null
        setState({ value: stored ?? fallback, loading: false })
      })
    return () => {
      active = false
    }
    // `fallback` is a literal at every call site; keying on it would refetch on
    // each render when it's an object, so only `key` drives the effect.
  }, [key])

  return state
}

// Convenience for the common {"enabled": boolean} flag shape.
export function useFeatureFlag(key: string): SettingState<boolean> {
  const { value, loading } = useSetting<{ enabled?: boolean }>(key, { enabled: false })
  return { value: value?.enabled === true, loading }
}

// Every setting row for an org (staff screens). Throws on error so the caller
// can show it.
export async function fetchSettings(orgId: string): Promise<Record<string, Json>> {
  const { data, error } = await supabase.from('app_settings').select('key, value').eq('org_id', orgId)
  if (error) throw error
  const out: Record<string, Json> = {}
  for (const row of data ?? []) out[row.key] = row.value
  return out
}

// Upsert one setting (staff). RLS enforces `settings.manage`.
export async function setSetting(
  key: string,
  value: Json,
  ctx: { orgId: string; userId?: string | null },
): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert(
    { org_id: ctx.orgId, key, value, updated_by: ctx.userId ?? null },
    { onConflict: 'org_id,key' },
  )
  if (error) throw error
}
