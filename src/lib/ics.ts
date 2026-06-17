// Build a downloadable .ics calendar file from BunFest sessions, so a visitor
// can drop the talks they've saved straight into their phone/computer calendar
// (and get reminders). Pure client-side — no backend, no accounts.
//
// Times come from the session data combined with the event's confirmed date
// (event.isoDate). We emit "floating" local times (no timezone), which every
// calendar app reads as the attendee's local time — correct for an in-person,
// single-location event.

import { event } from '../data/event'
import type { Session } from '../data/sessions'

// "HH:MM" (24h) -> {h, m}
function parse24(t: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!match) return null
  return { h: Number(match[1]), m: Number(match[2]) }
}

// The end of a "10:45 – 11:10 AM" range — the part after the dash, which always
// carries its own AM/PM in the session data. Returns 24h {h, m}.
function parseEndFromRange(time: string): { h: number; m: number } | null {
  const after = time.split(/[–—-]/).pop()
  if (!after) return null
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(after)
  if (!match) return null
  let h = Number(match[1]) % 12
  if (match[3].toUpperCase() === 'PM') h += 12
  return { h, m: Number(match[2]) }
}

// 2026-10-25 + 13:30 -> "20261025T133000" (floating local, basic format)
function floating(isoDate: string, h: number, m: number): string {
  const ymd = isoDate.replace(/-/g, '')
  const hh = String(h).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  return `${ymd}T${hh}${mm}00`
}

// UTC timestamp for DTSTAMP, e.g. "20260617T091800Z"
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Escape per RFC 5545 (backslash, semicolon, comma, newlines).
function esc(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Fold lines longer than 75 octets per RFC 5545 (continuation = CRLF + space).
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

function vevent(s: Session, stamp: string): string | null {
  const start = parse24(s.start)
  const end = parseEndFromRange(s.time)
  if (!start) return null
  const dtStart = floating(event.isoDate, start.h, start.m)
  const dtEnd = end ? floating(event.isoDate, end.h, end.m) : null
  const where = `${event.venue.name}, ${event.venue.address}`
  const description = s.presenter ? `${s.presenter}\n\n${s.description}` : s.description

  const lines = [
    'BEGIN:VEVENT',
    `UID:bunfest-${event.edition}-${s.id}@ohiohouserabbitrescue.org`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dtStart}`,
    ...(dtEnd ? [`DTEND:${dtEnd}`] : []),
    `SUMMARY:${esc(s.title)}`,
    `DESCRIPTION:${esc(description)}`,
    `LOCATION:${esc(where)}`,
    'END:VEVENT',
  ]
  return lines.map(fold).join('\r\n')
}

/** Build a full VCALENDAR string for the given sessions. */
export function buildIcs(sessions: Session[]): string {
  const stamp = utcStamp(new Date())
  const events = sessions
    .filter((s) => !s.isBreak)
    .map((s) => vevent(s, stamp))
    .filter((v): v is string => v !== null)

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ohio House Rabbit Rescue//Midwest BunFest//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * A Google Calendar "add event" template URL for a single session. Google's
 * template endpoint takes one event at a time, so the UI offers these per
 * session (vs. the .ics, which adds them all at once for Apple/iOS). `ctz`
 * pins the time to Eastern — the event's local zone — so it's correct no matter
 * the attendee's device timezone.
 */
export function googleCalendarUrl(s: Session): string | null {
  const start = parse24(s.start)
  if (!start) return null
  const end = parseEndFromRange(s.time) ?? addMinutes(start, 30)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: s.title,
    dates: `${floating(event.isoDate, start.h, start.m)}/${floating(event.isoDate, end.h, end.m)}`,
    details: s.presenter ? `${s.presenter}\n\n${s.description}` : s.description,
    location: `${event.venue.name}, ${event.venue.address}`,
    ctz: 'America/New_York',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function addMinutes(t: { h: number; m: number }, mins: number): { h: number; m: number } {
  const total = (t.h * 60 + t.m + mins) % (24 * 60)
  return { h: Math.floor(total / 60), m: total % 60 }
}

/** Trigger a download of the sessions as a .ics file. */
export function downloadIcs(sessions: Session[], filename = 'midwest-bunfest.ics') {
  const blob = new Blob([buildIcs(sessions)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
