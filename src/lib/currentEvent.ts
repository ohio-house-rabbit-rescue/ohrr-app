// The event the Silent Auction, the raffle and the table holds are for (update 48).
//
// It used to be written into the code ("midwest-bunfest-2026"), so every new
// event needed a code change. Now staff pick it (or type a new one) on
// Staff → Silent Auction, and the choice is one app_settings row:
//   key 'auction_event' → {"slug": "midwest-bunfest-2027", "title": "Midwest BunFest 2027", "date": "2027-10-24"}
// (public, like every setting; nothing secret in it).
//
// main.tsx reads it BEFORE the rest of the app is loaded, so every screen and
// every constant that mentions the event sees the chosen one from the first
// line. Changing it therefore reloads the page. If the database can't be
// reached, the last one this phone saw is used, then the 2026 BunFest.
import { supabase, isSupabaseConfigured } from './supabase'

export interface CurrentEvent {
  slug: string
  /** "Midwest BunFest 2026" */
  title: string
  /** The event's day, "2026-10-25" (Ohio time): close times typed as "4:00 PM" land on it. */
  date: string
}

export const DEFAULT_EVENT: CurrentEvent = { slug: 'midwest-bunfest-2026', title: 'Midwest BunFest 2026', date: '2026-10-25' }

export const EVENT_SETTING_KEY = 'auction_event'
const CACHE_KEY = 'ohrr.currentEvent'

/** The live record. Filled by loadCurrentEvent() before the app starts; never reassigned. */
export const currentEvent: CurrentEvent = { ...DEFAULT_EVENT }

function valid(v: unknown): v is CurrentEvent {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.slug === 'string' &&
    /^[a-z0-9][a-z0-9-]{1,58}$/.test(o.slug) &&
    typeof o.title === 'string' &&
    o.title.trim() !== '' &&
    typeof o.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(o.date)
  )
}

function apply(v: CurrentEvent) {
  currentEvent.slug = v.slug
  currentEvent.title = v.title
  currentEvent.date = v.date
}

function remember(v: CurrentEvent) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(v))
  } catch {
    /* private mode */
  }
}

function remembered(): CurrentEvent | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')
    return valid(v) ? v : null
  } catch {
    return null
  }
}

/** One quick read of the setting; waits at most `timeoutMs`, never throws. */
export async function loadCurrentEvent(timeoutMs = 2500): Promise<CurrentEvent> {
  const last = remembered()
  if (last) apply(last)
  if (!isSupabaseConfigured) return currentEvent
  try {
    const read = supabase
      .from('app_settings')
      .select('value')
      .eq('key', EVENT_SETTING_KEY)
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => (error ? undefined : (data?.value ?? null)))
    const stored = await Promise.race([read, new Promise<undefined>((r) => setTimeout(() => r(undefined), timeoutMs))])
    if (stored === undefined) return currentEvent // no answer in time: the remembered one stands
    if (valid(stored)) {
      apply(stored)
      remember(stored)
    } else {
      apply(DEFAULT_EVENT) // nothing chosen yet (or the row was removed)
      remember(DEFAULT_EVENT)
    }
  } catch {
    /* keep what we have */
  }
  return currentEvent
}

/** "2027-10-24" → "Sunday, October 24, 2027" (the day itself, whatever the phone's time zone). */
export function dayLabel(date: string, long = true): string {
  const d = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-US', {
    weekday: long ? 'long' : 'short',
    month: long ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** The Ohio calendar day of a moment, "YYYY-MM-DD". */
export function ohioDay(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** The chosen event shaped like the BunFest record the desks read (title + a moment on its day). */
export function currentEventRecord(): { title: string; startsAt: string } {
  return { title: currentEvent.title, startsAt: `${currentEvent.date}T12:00:00Z` }
}
