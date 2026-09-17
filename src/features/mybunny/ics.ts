// iCalendar (.ics) generation for My Bunny reminders — pure functions, no
// library. The phone's own calendar app does the alerting once the event is
// added, so reminders fire even when this app is never opened.
//
// RFC 5545 details handled here: text escaping (backslash, semicolon, comma,
// newline), CRLF line endings, folding at 75 octets (UTF-8 aware, never splits
// a character), a UID per event, DTSTAMP, RRULE for repeats and a VALARM.
//
// Times are emitted as "floating" local time (no TZID): 09:00 means 9 AM in
// whatever timezone the phone is in, which is exactly what a care reminder
// should mean. It is also the only fully-conformant way to say that without
// shipping a VTIMEZONE block.

import type { Reminder } from './storage'

export const APP_URL = 'https://ohrr-app.pages.dev/my-bunny'
const PRODID = '-//Ohio House Rabbit Rescue//OHRR App My Bunny//EN'
const UID_DOMAIN = 'mybunny.ohrr-app.pages.dev'

export interface IcsEvent {
  uid: string
  summary: string
  description?: string
  url?: string
  /** YYYY-MM-DD, local */
  date: string
  /** default 9 (09:00 local) */
  hour?: number
  minute?: number
  /** default 30 */
  durationMinutes?: number
  /** Repeat every N days (365/366 becomes FREQ=YEARLY); null/undefined = once. */
  repeatEveryDays?: number | null
  /** VALARM triggers as ISO 8601 durations, e.g. '-PT0M' (at the time) or '-P1D'. */
  alarms?: string[]
}

/* ------------------------------------------------------------ primitives */

/** Escape TEXT values per RFC 5545 §3.3.11. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const encoder = new TextEncoder()

function byteLength(s: string): number {
  return encoder.encode(s).length
}

/**
 * Fold a content line so no physical line exceeds 75 octets (§3.1). The
 * continuation lines start with a single space, which counts toward the 75.
 * Iterates by code point so a multi-byte character is never cut in half.
 */
export function foldLine(line: string): string {
  if (byteLength(line) <= 75) return line
  const out: string[] = []
  let current = ''
  let currentBytes = 0
  for (const ch of line) {
    const b = byteLength(ch)
    if (currentBytes + b > 75) {
      out.push(current)
      current = ' ' + ch
      currentBytes = 1 + b
    } else {
      current += ch
      currentBytes += b
    }
  }
  out.push(current)
  return out.join('\r\n')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 2026-09-17 + 9:00 -> "20260917T090000" (floating local time). */
export function formatLocalDateTime(date: string, hour: number, minute: number): string {
  return `${date.replace(/-/g, '')}T${pad2(hour)}${pad2(minute)}00`
}

/** UTC timestamp for DTSTAMP, e.g. "20260917T131500Z". */
export function formatUtcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Local end time for a start date + minutes, formatted the same way. */
export function formatLocalEnd(date: string, hour: number, minute: number, durationMinutes: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const end = new Date(y, m - 1, d, hour, minute + durationMinutes)
  const ymd = `${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`
  return formatLocalDateTime(ymd, end.getHours(), end.getMinutes())
}

export function rruleFor(days: number): string {
  if (days === 365 || days === 366) return 'RRULE:FREQ=YEARLY'
  return `RRULE:FREQ=DAILY;INTERVAL=${Math.max(1, Math.round(days))}`
}

/* ---------------------------------------------------------------- events */

/** Unfolded content lines for one VEVENT. */
export function buildVEvent(e: IcsEvent, now: Date = new Date()): string[] {
  const hour = e.hour ?? 9
  const minute = e.minute ?? 0
  const duration = e.durationMinutes ?? 30
  const lines = [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${formatUtcStamp(now)}`,
    `DTSTART:${formatLocalDateTime(e.date, hour, minute)}`,
    `DTEND:${formatLocalEnd(e.date, hour, minute, duration)}`,
    `SUMMARY:${escapeText(e.summary)}`,
  ]
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`)
  if (e.url) lines.push(`URL:${e.url}`)
  if (e.repeatEveryDays && e.repeatEveryDays >= 1) lines.push(rruleFor(e.repeatEveryDays))
  for (const trigger of e.alarms ?? ['-PT0M']) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.summary)}`,
      `TRIGGER:${trigger}`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT')
  return lines
}

/** Full VCALENDAR text: CRLF line endings, every line folded. */
export function buildCalendar(events: IcsEvent[], now: Date = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((e) => buildVEvent(e, now)),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/* ------------------------------------------------------ reminder mapping */

function isYearly(days: number | null): boolean {
  return days === 365 || days === 366
}

/** The calendar event for one reminder, e.g. "Nail trim — Clover (OHRR app)". */
export function reminderEvent(r: Reminder, bunnyName: string): IcsEvent {
  const parts = [
    r.notes?.trim() || '',
    r.intervalDays ? `Repeats every ${r.intervalDays} days.` : '',
    `Added from the OHRR app — My Bunny: ${APP_URL}`,
  ].filter(Boolean)
  return {
    uid: `${r.id}@${UID_DOMAIN}`,
    summary: `${r.title} — ${bunnyName} (OHRR app)`,
    description: parts.join('\n\n'),
    url: APP_URL,
    date: r.nextDue,
    hour: 9,
    minute: 0,
    durationMinutes: 30,
    repeatEveryDays: r.intervalDays,
    // A day's notice for yearly items (vaccine, check-up) so there's time to
    // book; everything else alerts at 9 AM on the day.
    alarms: isYearly(r.intervalDays) ? ['-P1D', '-PT0M'] : ['-PT0M'],
  }
}

export function buildReminderIcs(r: Reminder, bunnyName: string, now?: Date): string {
  return buildCalendar([reminderEvent(r, bunnyName)], now)
}

export function buildAllRemindersIcs(reminders: Reminder[], bunnyName: string, now?: Date): string {
  return buildCalendar(
    reminders.map((r) => reminderEvent(r, bunnyName)),
    now,
  )
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // drop the combining marks NFKD split off (ñ → n)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'reminder'
  )
}

export function reminderFilename(r: Reminder, bunnyName: string): string {
  return `${slugify(r.title)}-${slugify(bunnyName)}.ics`
}

export function allRemindersFilename(bunnyName: string): string {
  return `${slugify(bunnyName)}-care-reminders.ics`
}

/**
 * Google Calendar's "add event" template URL for one reminder — handy on
 * Android where a downloaded .ics may land in the Downloads folder instead of
 * opening straight away. Google honours `recur=RRULE:...`.
 */
export function googleCalendarUrl(e: IcsEvent): string {
  const hour = e.hour ?? 9
  const minute = e.minute ?? 0
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.summary,
    dates: `${formatLocalDateTime(e.date, hour, minute)}/${formatLocalEnd(e.date, hour, minute, e.durationMinutes ?? 30)}`,
    details: e.description ?? '',
  })
  if (e.repeatEveryDays && e.repeatEveryDays >= 1) params.set('recur', rruleFor(e.repeatEveryDays))
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/* -------------------------------------------------------------- delivery */

/**
 * Hand the .ics to the phone as a file download. iPhone Safari shows the
 * download and tapping it opens Calendar's add sheet; Android hands it to the
 * calendar app. Same mechanism the BunFest schedule export already uses.
 */
export function downloadIcs(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), filename)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on a later tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
