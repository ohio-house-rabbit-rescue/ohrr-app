// The BunFest activity pages, from the database rather than the code.
//
// Bunny Spa prices, whether advance booking is open, the raffle's drawing
// time, the hotel's group code — all of it changes every year and all of it
// used to live in `src/data/bunfestPages.ts`, so publishing this year's
// details meant shipping a new app. Each page now comes from `bunfest_pages`
// for the year of the event being shown, with the bundled copy as the fallback
// until OHRR types theirs in (supabase/migrations/20260922150000_*.sql).
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { bunfestPageById, type BunfestPage, type InfoSection } from '../../data/bunfestPages'
import type { IconName } from '../../components/icons'
import { useBunfestEvent } from '../../lib/events'

type PageRow = Database['public']['Tables']['bunfest_pages']['Row']

export interface LivePage {
  page: BunfestPage | null
  source: 'live' | 'seed'
  loading: boolean
}

/** Icon names the app actually has; anything else falls back to a star. */
const KNOWN_ICONS = new Set<IconName>([
  'home', 'calendar', 'bag', 'heart', 'info', 'users', 'award', 'mappin', 'clock', 'book', 'gift',
  'ticket', 'mail', 'store', 'star', 'sparkles', 'camera', 'scan', 'gavel', 'phone', 'search', 'box',
] as IconName[])

function iconOf(name: string | null): IconName {
  return name && KNOWN_ICONS.has(name as IconName) ? (name as IconName) : 'star'
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

/** A jsonb column arrives as `unknown`; take only the shape the page renders. */
function toSections(v: unknown): InfoSection[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .map((s) => ({
      heading: str(s.heading),
      body: str(s.body),
      list: Array.isArray(s.list) ? s.list.filter((i): i is string => typeof i === 'string') : undefined,
      slot: s.slot === 'raffle-details' ? ('raffle-details' as const) : undefined,
    }))
    .filter((s) => s.heading || s.body || (s.list && s.list.length > 0))
}

function toRelated(v: unknown): { label: string; to: string }[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .map((r) => ({ label: str(r.label) ?? '', to: str(r.to) ?? '' }))
    .filter((r) => r.label && r.to)
}

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function rowToPage(r: PageRow): BunfestPage {
  const contact = toRecord(r.contact)
  const reserve = toRecord(r.reserve)
  const hasContact = ['address', 'phone', 'url'].some((k) => str(contact[k]))
  const related = toRelated(r.related)

  return {
    id: r.slug,
    title: r.title,
    subtitle: str(r.subtitle),
    icon: iconOf(r.icon),
    sponsor: str(r.sponsor_note),
    chips: r.chips.length > 0 ? r.chips : undefined,
    note: str(r.note),
    sections: toSections(r.sections),
    feature: r.feature ?? undefined,
    // A reserve page without a form name would render a form that goes nowhere.
    reserve:
      r.feature === 'reserve' && str(reserve.formName)
        ? {
            formName: str(reserve.formName) as string,
            services: Array.isArray(reserve.services)
              ? reserve.services.filter((s): s is string => typeof s === 'string')
              : undefined,
          }
        : undefined,
    emailSignup: str(r.email_signup),
    contact: hasContact
      ? {
          address: str(contact.address),
          phone: str(contact.phone),
          url: str(contact.url),
          urlLabel: str(contact.urlLabel),
        }
      : undefined,
    relatedLabel: str(r.related_label),
    related: related.length > 0 ? related : undefined,
  }
}

/** One activity page for the year of the BunFest currently being shown. */
export function useBunfestPage(slug: string | undefined): LivePage {
  const bunfest = useBunfestEvent()
  const year = new Date(bunfest.startsAt).getFullYear()
  const seed = slug ? (bunfestPageById(slug) ?? null) : null
  const [state, setState] = useState<LivePage>({
    page: seed,
    source: 'seed',
    loading: isSupabaseConfigured && !!slug,
  })

  useEffect(() => {
    setState({ page: seed, source: 'seed', loading: isSupabaseConfigured && !!slug })
    if (!isSupabaseConfigured || !slug) return
    let active = true
    supabase
      .from('bunfest_pages')
      .select('*')
      .eq('slug', slug)
      .eq('year', year)
      .eq('is_published', true)
      .limit(1)
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data || data.length === 0) {
          setState({ page: seed, source: 'seed', loading: false })
          return
        }
        setState({ page: rowToPage(data[0]), source: 'live', loading: false })
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, year])

  return state
}
