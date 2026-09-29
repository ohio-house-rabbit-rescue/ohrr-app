// Hooks for the auction screens: the catalog (polled, with a fallback for
// before update 35 runs), one item from it, and a bidder's own page.
//
// The fallback matters: `auction_catalog()` only exists once
// supabase/migrations/20260930100000_silent_auction_bidding.sql has been pasted
// into the live database. Until then the catalog reads `raffle_items` straight
// (as it always did) and shapes each row like the function's JSON, with bidding
// closed — so the public pages never break.
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { AUCTION_EVENT_SLUG } from '../raffle/types'
import {
  fetchCatalog,
  fetchMyPage,
  recallBidder,
  rememberBidder,
  forgetBidder,
  type AuctionItem,
  type Catalog,
  type MyPage,
  type RememberedBidder,
  type Session,
} from './client'

type ItemRow = Database['public']['Tables']['raffle_items']['Row']
type SettingsRow = Database['public']['Tables']['auction_settings']['Row']

export const CATALOG_POLL_MS = 15_000

/** Shape a plain table row like auction_item_json() does (bidding closed). */
export function rowToItem(r: ItemRow, s: SettingsRow | null): AuctionItem {
  const increment = r.min_increment_cents ?? s?.default_increment_cents ?? 500
  const current = r.current_bid_cents ?? null
  const sessionClose = r.session === 'morning' ? s?.morning_closes_at : s?.afternoon_closes_at
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    donated_by: r.donated_by,
    value_cents: r.value_cents,
    photo_url: r.photo_url,
    session: (r.session as Session) ?? 'all-day',
    status: r.status === 'won' ? 'won' : 'available',
    won_kind: r.won_kind ?? null,
    sort_order: r.sort_order,
    starting_bid_cents: r.starting_bid_cents ?? null,
    increment_cents: increment,
    buy_now_cents: r.buy_now_cents ?? null,
    ship_fee_cents: r.ship_fee_cents ?? null,
    current_bid_cents: current,
    next_min_cents: current != null ? current + increment : (r.starting_bid_cents ?? increment),
    bid_count: r.bid_count ?? 0,
    high_bidder_no: r.high_bidder_no ?? null,
    closes_at: r.closes_at_override ?? sessionClose ?? null,
    is_open: false,
  }
}

async function readFallback(): Promise<{ catalog: Catalog; intro: string | null }> {
  const [itemsRes, settingsRes] = await Promise.all([
    supabase
      .from('raffle_items')
      .select('*')
      .eq('event_slug', AUCTION_EVENT_SLUG)
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true }),
    supabase.from('auction_settings').select('*').eq('event_slug', AUCTION_EVENT_SLUG).limit(1).maybeSingle(),
  ])
  if (itemsRes.error) throw itemsRes.error
  const settings = settingsRes.data ?? null
  const rows = (itemsRes.data ?? []).filter((r) => r.is_published && r.event_slug === AUCTION_EVENT_SLUG)
  return {
    catalog: { now: new Date().toISOString(), settings: null, items: rows.map((r) => rowToItem(r, settings)) },
    intro: settings?.intro_text ?? null,
  }
}

export interface CatalogState {
  /** null while the first load is in flight. */
  catalog: Catalog | null
  /** True when the bidding function isn't on the database yet (plain table read). */
  fallback: boolean
  /** The intro line staff set — from the function when it exists, else the table. */
  intro: string | null
  error: string | null
  refresh: () => Promise<void>
}

/** The catalog, refreshed every 15 s while the screen is open. */
export function useCatalog(poll = true): CatalogState {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [fallback, setFallback] = useState(false)
  const [intro, setIntro] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCatalog({ now: new Date().toISOString(), settings: null, items: [] })
      return
    }
    try {
      const c = await fetchCatalog(supabase)
      if (!alive.current) return
      setCatalog({ ...c, items: c.items ?? [] })
      setIntro(c.settings?.intro_text ?? null)
      setFallback(false)
      setError(null)
    } catch {
      // Before update 35 (or if the function is unreachable): the table read.
      try {
        const fb = await readFallback()
        if (!alive.current) return
        setCatalog(fb.catalog)
        setIntro(fb.intro)
        setFallback(true)
        setError(null)
      } catch (e) {
        if (!alive.current) return
        setError(e instanceof Error ? e.message : 'Could not load the auction.')
        setCatalog((c) => c ?? { now: new Date().toISOString(), settings: null, items: [] })
      }
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void refresh()
    if (!poll) return () => { alive.current = false }
    const t = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, CATALOG_POLL_MS)
    return () => {
      alive.current = false
      clearInterval(t)
    }
  }, [refresh, poll])

  return { catalog, fallback, intro, error, refresh }
}

/** One item out of the polled catalog. `undefined` while loading; `null` when it isn't listed. */
export function useCatalogItem(id: string | undefined): { item: AuctionItem | null | undefined; state: CatalogState } {
  const state = useCatalog(true)
  if (!id || !state.catalog) return { item: id ? undefined : null, state }
  return { item: state.catalog.items.find((i) => i.id === id) ?? null, state }
}

export interface MyPageState {
  page: MyPage | null | undefined
  error: string | null
  refresh: () => Promise<void>
}

/**
 * The bidder's own page by private token: `undefined` while loading, `null`
 * when the token isn't one we know. With `remember`, a good answer is kept on
 * this device (a link opened on a new phone); a bad one is forgotten.
 */
export function useMyPage(token: string | null, opts: { poll?: boolean; remember?: boolean } = {}): MyPageState {
  const { poll = true, remember = false } = opts
  const [page, setPage] = useState<MyPage | null | undefined>(token ? undefined : null)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    if (!token || !isSupabaseConfigured) {
      setPage(null)
      return
    }
    try {
      const p = await fetchMyPage(supabase, token)
      if (!alive.current) return
      setPage(p)
      setError(null)
      if (p && remember) rememberBidder(p.bidder)
      if (!p) {
        // The device remembers a registration the database doesn't know (a
        // reset, or a link from another event): stop showing it as yours.
        const mine = recallBidder()
        if (mine && mine.access_token === token) forgetBidder()
      }
    } catch (e) {
      if (!alive.current) return
      const msg = e instanceof Error ? e.message : ''
      // Before update 35 the function isn't there: say so in plain words.
      setError(/could not find the function|schema cache|does not exist/i.test(msg) ? 'Online bidding hasn’t been set up for this event yet.' : msg || 'Could not load your bids.')
      setPage((p) => (p === undefined ? null : p))
    }
  }, [token, remember])

  useEffect(() => {
    alive.current = true
    void refresh()
    if (!poll || !token) return () => { alive.current = false }
    const t = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, CATALOG_POLL_MS)
    return () => {
      alive.current = false
      clearInterval(t)
    }
  }, [refresh, poll, token])

  return { page, error, refresh }
}

/** The bidder this device remembers (re-read on every render — it's tiny). */
export function useRememberedBidder(): RememberedBidder | null {
  const [b, setB] = useState<RememberedBidder | null>(() => recallBidder())
  useEffect(() => {
    const onStorage = () => setB(recallBidder())
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onStorage)
    }
  }, [])
  return b
}

/** Only in-app paths may be a "next" destination (never another site). */
export function safeNext(next: string | null | undefined, fallback = '/bunfest/auction'): string {
  return next && /^\/(?!\/)/.test(next) ? next : fallback
}

/** "Ships +$8" / "Pickup only". */
export function shipLine(item: AuctionItem): string {
  if (item.ship_fee_cents == null) return 'Pickup only'
  return item.ship_fee_cents === 0 ? 'Ships free' : `Ships +$${(item.ship_fee_cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
