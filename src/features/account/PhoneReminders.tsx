// "Remind me on this phone" (My OHRR, Android / iOS app only). One switch, and
// what it covers:
//   - saved BunFest sessions: 30 minutes before each talk;
//   - events added from this phone ("Add to calendar"): the morning of;
//   - bookings made on this phone: the evening before and 1 hour before (the
//     same two notifications the booking screen's "Remind me" button sets, on
//     the same ids, so they never double up).
// Everything is a local notification the phone schedules itself; nothing goes
// to a server. The web keeps its calendar buttons. My Bunny's care reminders
// are separate and unchanged — each one is still switched on by itself.
//
// <PhoneReminderScheduler /> (mounted once in App.tsx) keeps the scheduled set
// in step with what's saved: save a session and its reminder appears; unsave
// it and it goes.
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Card, SectionLabel } from '../../components/ui'
import { isNative } from '../../native/platform'
import { ensureNotificationPermission } from '../../native/notifications'
import { notificationBase } from '../../native/reminderSchedule'
import { useSavedSessions } from '../../lib/savedSessions'
import { useBunfestSessions } from '../bunfest/content'
import { useBunfestEvent, useEvents, eventIsoDay } from '../../lib/events'
import { useMyBookings, type MyBooking } from '../bookings/mine'
import { useAddedEvents, type AddedEvent } from './addedEvents'

/* ------------------------------------------------------------ choices */

export interface PhoneReminderPrefs {
  on: boolean
  sessions: boolean
  events: boolean
  bookings: boolean
}

const PREFS_KEY = 'ohrr.phoneReminders.v1'
const SCHEDULED_KEY = 'ohrr.phoneReminders.ids.v1'
const DEFAULTS: PhoneReminderPrefs = { on: false, sessions: true, events: true, bookings: true }

const listeners = new Set<() => void>()
let prefs: PhoneReminderPrefs = readPrefs()

function readPrefs(): PhoneReminderPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<PhoneReminderPrefs> | null
    return v ? { ...DEFAULTS, ...v } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function setPhoneReminderPrefs(patch: Partial<PhoneReminderPrefs>) {
  prefs = { ...prefs, ...patch }
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* private mode — keep it in memory */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => prefs

export function usePhoneReminderPrefs(): PhoneReminderPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* ------------------------------------------------------------ planning */

interface Planned {
  id: number
  title: string
  body: string
  at: Date
  /** Where a tap on it opens. */
  to: string
}

const clock = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/** "2026-10-25" + "13:30" → that local time. */
function localAt(isoDay: string, hhmm: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay)
  const t = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!d || !t) return null
  const at = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), 0, 0)
  return Number.isNaN(at.getTime()) ? null : at
}

function planSessions(
  sessions: { id: string; title: string; start: string; isBreak?: boolean }[],
  saved: Set<string>,
  day: string,
  venue: string | undefined,
): Planned[] {
  return sessions
    .filter((s) => saved.has(s.id) && !s.isBreak)
    .flatMap((s) => {
      const start = localAt(day, s.start)
      if (!start) return []
      return [
        {
          id: notificationBase(`session:${s.id}`) * 8,
          title: s.title,
          body: `Starts at ${clock(start)}${venue ? ` · ${venue}` : ''}. Midwest BunFest.`,
          at: new Date(start.getTime() - 30 * 60_000),
          to: '/bunfest/schedule',
        },
      ]
    })
}

function planEvents(added: AddedEvent[]): Planned[] {
  return added.flatMap((e) => {
    const start = new Date(e.startsAt)
    if (Number.isNaN(start.getTime())) return []
    // 9 in the morning of the day — or an hour ahead for an early start.
    const nine = localAt(eventIsoDay(e), '09:00') ?? start
    const at = nine.getTime() < start.getTime() ? nine : new Date(start.getTime() - 3_600_000)
    return [
      {
        // Slots 0 and 1 are the event sheet's own "evening before / hour ahead".
        id: notificationBase(`event:${e.slug}`) * 8 + 2,
        title: e.title,
        body: `Today at ${clock(start)}${e.venue ? ` · ${e.venue}` : ''}`,
        at,
        to: '/events',
      },
    ]
  })
}

function planBookings(bookings: MyBooking[]): Planned[] {
  return bookings
    .filter((b) => b.status !== 'cancelled')
    .flatMap((b) => {
      const start = new Date(b.startsAt)
      if (Number.isNaN(start.getTime())) return []
      const eve = new Date(start)
      eve.setDate(eve.getDate() - 1)
      eve.setHours(18, 0, 0, 0)
      // The same ids as calendar.ts's scheduleBookingReminders().
      const base = notificationBase(`booking:${b.bookingId}`) * 8
      const title = `${b.typeName} — OHRR`
      const to = `/book/cancel/${b.token}`
      return [
        { id: base, title, body: `Tomorrow at ${clock(start)}`, at: eve, to },
        { id: base + 1, title, body: 'In one hour', at: new Date(start.getTime() - 3_600_000), to },
      ]
    })
}

function readScheduled(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(SCHEDULED_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}
function writeScheduled(ids: number[]) {
  try {
    localStorage.setItem(SCHEDULED_KEY, JSON.stringify(ids))
  } catch {
    /* private mode */
  }
}

/** Replace what this switch scheduled with `plan` (only future times). */
async function applyPlan(plan: Planned[]) {
  if (!isNative) return
  const { LocalNotifications: ln } = await import('@capacitor/local-notifications')
  const { display } = await ln.checkPermissions()
  if (display !== 'granted') return
  const future = plan.filter((p) => p.at.getTime() > Date.now())
  const ids = [...new Set([...readScheduled(), ...future.map((p) => p.id)])]
  if (ids.length > 0) await ln.cancel({ notifications: ids.map((id) => ({ id })) })
  if (future.length > 0) {
    await ln.schedule({
      notifications: future.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: { to: p.to },
      })),
    })
  }
  writeScheduled(future.map((p) => p.id))
}

/** Switched off: take back everything the switch scheduled. */
async function cancelPlanned() {
  if (!isNative) return
  const ids = readScheduled()
  if (ids.length === 0) return
  const { LocalNotifications: ln } = await import('@capacitor/local-notifications')
  await ln.cancel({ notifications: ids.map((id) => ({ id })) })
  writeScheduled([])
}

/** Mounted once. Keeps the phone's scheduled reminders in step with what's saved. */
export function PhoneReminderScheduler() {
  const p = usePhoneReminderPrefs()
  useEffect(() => {
    if (isNative && !p.on) void cancelPlanned().catch(() => undefined)
  }, [p.on])
  if (!isNative || !p.on) return null
  return <Planner prefs={p} />
}

function Planner({ prefs: p }: { prefs: PhoneReminderPrefs }) {
  const saved = useSavedSessions()
  const { items: sessions } = useBunfestSessions()
  const bunfest = useBunfestEvent()
  const { events } = useEvents()
  const added = useAddedEvents()
  const bookings = useMyBookings()

  const plan = useMemo(() => {
    // An event's time can change after it was added: use the live one.
    const live = added.map((a) => {
      const e = events.find((x) => x.slug === a.slug)
      return e ? { ...a, title: e.title, startsAt: e.startsAt, venue: e.venue } : a
    })
    return [
      ...(p.sessions ? planSessions(sessions, saved, eventIsoDay(bunfest), bunfest.venue) : []),
      ...(p.events ? planEvents(live) : []),
      ...(p.bookings ? planBookings(bookings) : []),
    ]
  }, [p.sessions, p.events, p.bookings, sessions, saved, bunfest, events, added, bookings])

  const key = plan.map((x) => `${x.id}@${x.at.getTime()}:${x.title}`).join('|')
  useEffect(() => {
    void applyPlan(plan).catch(() => undefined)
    // `key` stands for the plan's contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return null
}

/* ------------------------------------------------------------ the section */

export function PhoneRemindersSection() {
  const p = usePhoneReminderPrefs()
  const saved = useSavedSessions().size
  const added = useAddedEvents().length
  const booked = useMyBookings().filter((b) => b.status !== 'cancelled').length
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)

  if (!isNative) return null

  const flip = async () => {
    if (p.on) {
      setPhoneReminderPrefs({ on: false })
      return
    }
    setBusy(true)
    setDenied(false)
    const ok = await ensureNotificationPermission().catch(() => false)
    setBusy(false)
    if (!ok) {
      setDenied(true)
      return
    }
    setPhoneReminderPrefs({ on: true })
  }

  const choices: { key: 'sessions' | 'events' | 'bookings'; label: string; when: string; n: number }[] = [
    { key: 'sessions', label: 'Saved BunFest sessions', when: '30 minutes before', n: saved },
    { key: 'events', label: 'Events you’ve added', when: 'The morning of', n: added },
    { key: 'bookings', label: 'Bookings made on this phone', when: 'The day before, and 1 hour before', n: booked },
  ]

  return (
    <section className="space-y-2">
      <SectionLabel>Phone reminders</SectionLabel>
      <Card className="space-y-3">
        <button
          type="button"
          role="switch"
          aria-checked={p.on}
          disabled={busy}
          onClick={() => void flip()}
          className="flex min-h-[48px] w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block font-display text-[15px] font-extrabold text-ink">Remind me on this phone</span>
            <span className="block text-sm text-slate-500">Notifications for what you’ve saved</span>
          </span>
          <span
            aria-hidden
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${p.on ? 'bg-brand-blue' : 'bg-slate-300'}`}
          >
            <span className={`absolute h-6 w-6 rounded-full bg-white shadow transition ${p.on ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>
        {denied && (
          <p className="text-xs leading-relaxed text-slate-500">
            Notifications are off for the OHRR app — turn them on in your phone’s Settings, then try again.
          </p>
        )}
        {p.on && (
          <div className="space-y-1 border-t border-slate-100 pt-2">
            {choices.map((c) => (
              <label key={c.key} className="flex min-h-[48px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-blue"
                  checked={p[c.key]}
                  onChange={(e) => setPhoneReminderPrefs({ [c.key]: e.target.checked })}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{c.label}</span>
                  <span className="block text-xs text-slate-500">
                    {c.when} · {c.n === 0 ? 'none yet' : `${c.n} now`}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs leading-relaxed text-slate-500">
          My Bunny’s care reminders are set on each reminder, as before.
        </p>
      </Card>
    </section>
  )
}
