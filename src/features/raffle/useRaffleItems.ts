// Public hooks for the Silent Raffle catalog. Both read straight from Supabase
// with the anon key; RLS already restricts anonymous reads to published,
// still-available items, and we filter client-side too so a stale cache can
// never show something that's gone. Any error or missing config quietly
// resolves to "nothing to show" — the screens render their empty state.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { RAFFLE_EVENT_SLUG, sortRaffleItems, type RaffleItem } from './types'

function isPublicVisible(item: RaffleItem): boolean {
  return item.is_published && item.status === 'available' && item.event_slug === RAFFLE_EVENT_SLUG
}

// All available items for the event. `null` while loading, then an array
// (empty when none).
export function useRaffleItems(): RaffleItem[] | null {
  const [items, setItems] = useState<RaffleItem[] | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .from('raffle_items')
      .select('*')
      .eq('event_slug', RAFFLE_EVENT_SLUG)
      .eq('is_published', true)
      .eq('status', 'available')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .then(({ data }) => {
        if (active) setItems(sortRaffleItems((data ?? []).filter(isPublicVisible)))
      })
    return () => {
      active = false
    }
  }, [])

  return items
}

// One item by id. `undefined` while loading; `null` when it isn't (or is no
// longer) publicly visible.
export function useRaffleItem(id: string | undefined): RaffleItem | null | undefined {
  const [item, setItem] = useState<RaffleItem | null | undefined>(undefined)

  useEffect(() => {
    if (!id || !isSupabaseConfigured) {
      setItem(null)
      return
    }
    let active = true
    setItem(undefined)
    supabase
      .from('raffle_items')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setItem(data && isPublicVisible(data) ? data : null)
      })
    return () => {
      active = false
    }
  }, [id])

  return item
}
