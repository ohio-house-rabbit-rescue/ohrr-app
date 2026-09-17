// Public read hooks for sponsors & placements. Both fall back SILENTLY to an
// empty list (backend not configured, table missing, network error) so every
// public screen that mounts them is safe before the migration is applied.
//
// Each returns null while loading, then an array — callers can show a clean
// empty state once it's [] rather than flashing it during the fetch.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import {
  rowToPlacement,
  rowToSponsor,
  sortSponsors,
  type Placement,
  type Sponsor,
  type Surface,
} from './types'

const todayIso = () => new Date().toISOString().slice(0, 10)

// One fetch per page load, shared by every public screen (like lib/adopt.ts).
// The staff manager uses its own queries, so it never reads this cache.
let sponsorsCache: Promise<Sponsor[]> | null = null

export function getPublicSponsors(): Promise<Sponsor[]> {
  if (!isSupabaseConfigured) return Promise.resolve([])
  if (!sponsorsCache) {
    sponsorsCache = (async () => {
      try {
        // RLS already hides inactive / expired rows from the public; the explicit
        // filters keep a signed-in staff member's view identical to a visitor's.
        const { data, error } = await supabase
          .from('sponsors')
          .select('*')
          .eq('is_active', true)
          .or(`term_end.is.null,term_end.gte.${todayIso()}`)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
        if (error || !data) return []
        return sortSponsors(data.map(rowToSponsor))
      } catch {
        return []
      }
    })()
  }
  return sponsorsCache
}

/** Active, in-term sponsors sorted by tier → sort order. null while loading. */
export function useSponsors(): Sponsor[] | null {
  const [items, setItems] = useState<Sponsor[] | null>(null)
  useEffect(() => {
    let active = true
    getPublicSponsors().then((list) => {
      if (active) setItems(list)
    })
    return () => {
      active = false
    }
  }, [])
  return items
}

/** Live placements for one surface (active + inside their date window). null while loading. */
export function usePlacements(surface: Surface): Placement[] | null {
  const [items, setItems] = useState<Placement[] | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    const nowIso = new Date().toISOString()
    supabase
      .from('sponsor_placements')
      .select('*')
      .eq('surface', surface)
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order('created_at', { ascending: true })
      .then(
        ({ data, error }) => {
          if (active) setItems(error || !data ? [] : data.map(rowToPlacement))
        },
        () => {
          if (active) setItems([])
        },
      )
    return () => {
      active = false
    }
  }, [surface])

  return items
}
