// This year's Midwest BunFest, from the database rather than the code.
//
// The "at the festival" cards and the facts on Plan your visit (admission,
// parking, the rabbit rule, tickets, hotel) used to be constants, so a new year
// meant a new build. They now come from `event_features` and `events.info`
// (supabase/migrations/20260922140000_*.sql), with the bundled 2026 data as the
// fallback until OHRR types theirs in.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { activities as seedActivities, event as seedEvent, type Activity } from '../../data/event'
import type { IconName } from '../../components/icons'
import { useBunfestEvent } from '../../lib/events'

/** Icon names the app actually has; anything else falls back to a star. */
const KNOWN_ICONS = new Set<string>([
  'home', 'calendar', 'bag', 'heart', 'info', 'users', 'award', 'mappin', 'clock', 'book', 'gift',
  'ticket', 'mail', 'store', 'star', 'sparkles', 'camera', 'scan', 'gavel', 'phone', 'search', 'box',
])
function iconOf(name: string | null): IconName {
  return (name && KNOWN_ICONS.has(name) ? name : 'star') as IconName
}

export interface FeatureCard extends Activity {
  id: string
  /** External link, when the card points off the app. */
  href?: string
}

export interface ThisYear {
  features: FeatureCard[]
  source: 'live' | 'seed'
}

/** The "at the festival" cards for the event's year. */
export function useBunfestFeatures(): ThisYear {
  const bunfest = useBunfestEvent()
  const year = new Date(bunfest.startsAt).getFullYear()
  const [state, setState] = useState<ThisYear>({
    features: seedActivities.map((a, i) => ({ ...a, id: `seed-${i}` })),
    source: 'seed',
  })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('event_features')
      .select('*')
      .eq('is_published', true)
      .eq('year', year)
      .order('sort_order')
      .then(({ data, error }) => {
        if (!active || error || !data || data.length === 0) return
        setState({
          source: 'live',
          features: data.map((r) => ({
            id: r.id,
            title: r.title,
            text: r.blurb ?? '',
            icon: iconOf(r.icon),
            // An in-app path goes to the router; anything else opens outside.
            to: r.link_url && r.link_url.startsWith('/') ? r.link_url : '',
            href: r.link_url && !r.link_url.startsWith('/') ? r.link_url : undefined,
          })),
        })
      })
    return () => {
      active = false
    }
  }, [year])

  return state
}

/** The facts on Plan your visit, from `events.info` with the bundled fallback. */
export interface EventInfo {
  admission: { who: string; price: string }[]
  admissionNote: string
  parking: string
  rabbitRule?: string
  ticketsUrl?: string
  hotelUrl?: string
  volunteerUrl?: string
  merchUrl?: string
  logoCredit?: string
}

export function useEventInfo(): EventInfo {
  const bunfest = useBunfestEvent()
  const info = (bunfest.info ?? {}) as Record<string, unknown>
  const str = (k: string): string | undefined => (typeof info[k] === 'string' && info[k] ? (info[k] as string) : undefined)
  const admission = Array.isArray(info.admission)
    ? (info.admission as { who?: string; price?: string }[])
        .filter((a) => a && a.who && a.price)
        .map((a) => ({ who: String(a.who), price: String(a.price) }))
    : []

  return {
    admission: admission.length > 0 ? admission : seedEvent.admission,
    admissionNote: str('admission_note') ?? seedEvent.admissionNote,
    parking: str('parking') ?? seedEvent.venue.parking,
    rabbitRule: str('rabbit_rule'),
    ticketsUrl: str('tickets_url') ?? seedEvent.links.tickets,
    hotelUrl: str('hotel_url'),
    volunteerUrl: str('volunteer_url'),
    merchUrl: str('merch_url'),
    logoCredit: str('logo_credit'),
  }
}
