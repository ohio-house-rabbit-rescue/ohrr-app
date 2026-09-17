// Public hooks for the Silent Auction catalog. They read straight from Supabase
// with the anon key; RLS already restricts anonymous reads to published items,
// and we filter client-side too so a stale response can never show something
// that's been hidden. Any error or missing config quietly resolves to
// "nothing to show" — the screens render their empty state.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { AUCTION_EVENT_SLUG, sortAuctionItems, type AuctionItem, type AuctionSettings } from './types'

function isPublicVisible(item: AuctionItem): boolean {
  return item.is_published && item.event_slug === AUCTION_EVENT_SLUG
}

// All published items for the event (available first, then won). `null` while
// loading, then an array (empty when none).
export function useAuctionItems(): AuctionItem[] | null {
  const [items, setItems] = useState<AuctionItem[] | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setItems([])
      return
    }
    let active = true
    supabase
      .from('raffle_items')
      .select('*')
      .eq('event_slug', AUCTION_EVENT_SLUG)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true })
      .then(({ data }) => {
        if (active) setItems(sortAuctionItems((data ?? []).filter(isPublicVisible)))
      })
    return () => {
      active = false
    }
  }, [])

  return items
}

// One item by id. `undefined` while loading; `null` when it isn't (or is no
// longer) publicly visible.
export function useAuctionItem(id: string | undefined): AuctionItem | null | undefined {
  const [item, setItem] = useState<AuctionItem | null | undefined>(undefined)

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

// The event's auction setup row (intro line, raffle-ticket pricing/details).
// `null` when none is saved. Pass `enabled = false` to skip the fetch on
// screens that don't need it.
export function useAuctionSettings(enabled = true): AuctionSettings | null {
  const [settings, setSettings] = useState<AuctionSettings | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return
    let active = true
    supabase
      .from('auction_settings')
      .select('*')
      .eq('event_slug', AUCTION_EVENT_SLUG)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setSettings(data ?? null)
      })
    return () => {
      active = false
    }
  }, [enabled])

  return settings
}
