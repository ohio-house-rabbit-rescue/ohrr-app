import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabase'
import type { Database } from './database.types'
import { seedEvents, BUNFEST_EVENT_SLUG, type EventItem } from '../data/events'

export {
  eventDate,
  eventDateShort,
  eventTime,
  eventIsoDay,
  isUpcoming,
  mapsUrl,
  eventCalendarUrl,
} from './eventFormat'

export type EventRow = Database['public']['Tables']['events']['Row']

export function rowToEvent(r: EventRow): EventItem {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at ?? undefined,
    venue: r.venue ?? undefined,
    address: r.address ?? undefined,
    city: r.city ?? undefined,
    summary: r.summary ?? undefined,
    body: r.body ?? undefined,
    theme: r.theme ?? undefined,
    url: r.url ?? undefined,
  }
}

// One shared fetch per page load: the Events screen, the home card, and the
// BunFest sub-app all read the same list.
let cache: Promise<EventItem[] | null> | null = null

async function fetchLiveEvents(): Promise<EventItem[] | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('starts_at', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error || !data || data.length === 0) return null
    return data.map(rowToEvent)
  } catch {
    return null
  }
}

function getLiveEvents(): Promise<EventItem[] | null> {
  if (!cache) cache = fetchLiveEvents()
  return cache
}

export interface EventsResult {
  events: EventItem[]
  /** 'live' once the DB returned rows; 'seed' while loading or when absent */
  source: 'live' | 'seed'
}

// Public hook: live PUBLISHED events, silently falling back to the bundled seed
// (so the app is complete before the migration is applied). Never null — the
// seed renders immediately and is replaced when live rows arrive.
export function useEvents(): EventsResult {
  const [state, setState] = useState<EventsResult>({ events: seedEvents, source: 'seed' })
  useEffect(() => {
    let active = true
    getLiveEvents().then((live) => {
      if (active && live) setState({ events: live, source: 'live' })
    })
    return () => {
      active = false
    }
  }, [])
  return state
}

// The Midwest BunFest event record — live if present, else the seed — so the
// BunFest sub-app's date / time / venue / theme are never stale.
export function useBunfestEvent(): EventItem {
  const { events } = useEvents()
  return (
    events.find((e) => e.slug === BUNFEST_EVENT_SLUG) ??
    seedEvents.find((e) => e.slug === BUNFEST_EVENT_SLUG)!
  )
}
