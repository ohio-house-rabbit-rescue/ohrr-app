// Pure date/venue formatting for events (no React, no Supabase) — shared by the
// bundled BunFest seed (src/data/event.ts) and the live hooks (src/lib/events.ts).
import type { EventItem } from '../data/events'

// All event times are shown in OHRR's time zone regardless of the phone's.
export const EVENT_TZ = 'America/New_York'

export function eventDate(e: Pick<EventItem, 'startsAt'>): string {
  return new Date(e.startsAt).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: EVENT_TZ,
  })
}

export function eventDateShort(e: Pick<EventItem, 'startsAt'>): string {
  return new Date(e.startsAt).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: EVENT_TZ,
  })
}

function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: EVENT_TZ })
    .replace(':00', '')
}

export function eventTime(e: Pick<EventItem, 'startsAt' | 'endsAt'>): string {
  const start = fmtTime(e.startsAt)
  return e.endsAt ? `${start} – ${fmtTime(e.endsAt)}` : start
}

/** YYYY-MM-DD of the event day in OHRR's time zone (for calendar export). */
export function eventIsoDay(e: Pick<EventItem, 'startsAt'>): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: EVENT_TZ,
  }).formatToParts(new Date(e.startsAt))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function isUpcoming(e: Pick<EventItem, 'startsAt' | 'endsAt'>, now = Date.now()): boolean {
  const end = new Date(e.endsAt ?? e.startsAt).getTime()
  // an event counts as upcoming through the end of its day
  return end + 12 * 60 * 60 * 1000 >= now
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}

/** Google Calendar "add" link for an event (no download needed on phones). */
export function eventCalendarUrl(e: EventItem): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.startsAt)}/${stamp(e.endsAt ?? e.startsAt)}`,
    details: e.summary ?? '',
    location: [e.venue, e.address].filter(Boolean).join(', '),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
