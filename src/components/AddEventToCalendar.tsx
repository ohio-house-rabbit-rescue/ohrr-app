// "Add to calendar" for a whole event — the BunFest day (OHRR, 2026-09-24:
// where BunFest says the date / "Mark your calendars", people should be able to
// add it). Everything comes from the shared `events` row the screen already
// reads (start, end, venue, address), so it follows staff edits.
// Whichever way they add it, the event is remembered on this phone
// (features/account/addedEvents.ts) for My OHRR's "Remind me on this phone".
//
// One button opens a small sheet, like the schedule's CalendarSheet:
// - on the web: a calendar file (.ics — Apple, Outlook and most calendars) and
//   a Google Calendar link;
// - inside the Android / iOS app a blob download goes nowhere, so, as for
//   bookings, "Remind me on this phone" (local notifications the evening before
//   and an hour ahead) plus the Google link, which opens in the system browser.
import { useEffect, useState } from 'react'
import type { EventItem } from '../data/events'
import { downloadEventIcs } from '../lib/ics'
import { eventCalendarUrl, eventDate, eventTime } from '../lib/eventFormat'
import { isNative } from '../native/platform'
import { ensureNotificationPermission } from '../native/notifications'
import { notificationBase } from '../native/reminderSchedule'
import { rememberAddedEvent } from '../features/account/addedEvents'
import { Icon } from './icons'

/** Native: the evening before at 6 pm, and one hour ahead (same shape as booking reminders). */
async function scheduleEventReminders(e: EventItem): Promise<'scheduled' | 'denied'> {
  if (!(await ensureNotificationPermission())) return 'denied'
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const start = new Date(e.startsAt)
  const eve = new Date(start)
  eve.setDate(eve.getDate() - 1)
  eve.setHours(18, 0, 0, 0)
  const hour = new Date(start.getTime() - 3_600_000)
  const base = notificationBase(`event:${e.slug}`) * 8
  const where = e.venue ? ` · ${e.venue}` : ''
  const when = [eve, hour].filter((d) => d.getTime() > Date.now())
  await LocalNotifications.cancel({ notifications: [{ id: base }, { id: base + 1 }] })
  if (when.length === 0) return 'scheduled'
  await LocalNotifications.schedule({
    notifications: when.map((at, k) => ({
      id: base + k,
      title: e.title,
      body: at === eve ? `Tomorrow, ${eventTime(e)}${where}` : `In one hour${where}`,
      schedule: { at, allowWhileIdle: true },
    })),
  })
  return 'scheduled'
}

function Sheet({ event: e, onClose }: { event: EventItem; onClose: () => void }) {
  const [reminder, setReminder] = useState<'idle' | 'scheduled' | 'denied' | 'failed'>('idle')

  useEffect(() => {
    const onKey = (k: KeyboardEvent) => k.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const row =
    'flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-3.5 text-left transition hover:border-slate-300 hover:bg-slate-50'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Add to calendar">
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />

      <div className="relative z-10 max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 text-ink shadow-2xl">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold text-ink">Add to your calendar</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {e.title} · {eventDate(e)}, {eventTime(e)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {isNative ? (
            <button
              type="button"
              disabled={reminder === 'scheduled'}
              onClick={() => {
                rememberAddedEvent(e)
                scheduleEventReminders(e).then(
                  (r) => setReminder(r),
                  () => setReminder('failed'),
                )
              }}
              className={row}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue text-white">
                <Icon name={reminder === 'scheduled' ? 'check' : 'clock'} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold text-ink">
                  {reminder === 'scheduled' ? 'Reminders set on this phone' : 'Remind me on this phone'}
                </span>
                <span className="mt-0.5 block text-sm text-slate-500">The evening before, and an hour ahead</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                rememberAddedEvent(e)
                downloadEventIcs(e)
                onClose()
              }}
              className={row}
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Icon name="apple" size={24} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-extrabold text-ink">Apple / iPhone / Outlook</span>
                <span className="mt-0.5 block text-sm text-slate-500">A calendar file (.ics) for the whole day</span>
              </span>
            </button>
          )}
          {reminder === 'denied' && (
            <p className="px-1 text-xs text-slate-500">
              Notifications are off for the OHRR app — turn them on in your phone’s Settings, then tap again.
            </p>
          )}
          {reminder === 'failed' && <p className="px-1 text-xs text-slate-500">Couldn’t set that reminder. Please try again.</p>}

          <a href={eventCalendarUrl(e)} target="_blank" rel="noopener noreferrer" onClick={() => rememberAddedEvent(e)} className={row}>
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-blue-50 text-brand-blue">
              <Icon name="calendar" size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-extrabold text-ink">Google Calendar</span>
              <span className="mt-0.5 block text-sm text-slate-500">
                {isNative ? 'Opens Google Calendar in your browser' : 'Opens Google Calendar with it filled in'}
              </span>
            </span>
            <Icon name="external" size={16} className="shrink-0 text-slate-300" />
          </a>
        </div>

        {!isNative && <p className="mt-4 text-center text-xs text-slate-400">On iPhone choose Apple · on Android choose Google</p>}
      </div>
    </div>
  )
}

/** The one "Add to calendar" button; pass the look that suits where it sits. */
export default function AddEventToCalendar({ event, className }: { event: EventItem; className: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <Icon name="calendar" size={16} /> Add to calendar
      </button>
      {open && <Sheet event={event} onClose={() => setOpen(false)} />}
    </>
  )
}
