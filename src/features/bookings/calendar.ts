// "Put it in my calendar" for a booking: on the web an .ics download and a
// Google Calendar link; inside the Android/iOS app a local notification the
// evening before and one hour ahead (same plugin as My Bunny reminders).
import { isNative } from '../../native/platform'
import { ensureNotificationPermission } from '../../native/notifications'
import { notificationBase } from '../../native/reminderSchedule'
import type { BookingReceipt } from './types'

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '')
}
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

export function bookingTitle(b: BookingReceipt): string {
  return `${b.type_name} — OHRR`
}

export function bookingIcs(b: BookingReceipt): string {
  const uid = `${b.booking_id}@ohrr`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ohio House Rabbit Rescue//OHRR app//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.starts_at)}`,
    `DTEND:${stamp(b.ends_at)}`,
    `SUMMARY:${esc(bookingTitle(b))}`,
    b.location ? `LOCATION:${esc(b.location)}` : '',
    `DESCRIPTION:${esc(`${b.kind === 'shift' ? 'Volunteer shift' : 'Appointment'} at Ohio House Rabbit Rescue. Booked in the OHRR app.`)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(bookingTitle(b))} in 1 hour`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}

export function downloadBookingIcs(b: BookingReceipt) {
  const blob = new Blob([bookingIcs(b)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ohrr-booking.ics'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function googleCalendarUrl(b: BookingReceipt): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: bookingTitle(b),
    dates: `${stamp(b.starts_at)}/${stamp(b.ends_at)}`,
    details: `${b.kind === 'shift' ? 'Volunteer shift' : 'Appointment'} at Ohio House Rabbit Rescue.`,
    location: b.location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Native: two reminders (the evening before at 6 pm, and one hour ahead). */
export async function scheduleBookingReminders(b: BookingReceipt): Promise<'scheduled' | 'denied' | 'unsupported'> {
  if (!isNative) return 'unsupported'
  if (!(await ensureNotificationPermission())) return 'denied'
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const start = new Date(b.starts_at)
  const eve = new Date(start)
  eve.setDate(eve.getDate() - 1)
  eve.setHours(18, 0, 0, 0)
  const hour = new Date(start.getTime() - 3_600_000)
  const base = notificationBase(`booking:${b.booking_id}`) * 8
  const when = [eve, hour].filter((d) => d.getTime() > Date.now())
  await LocalNotifications.cancel({ notifications: [{ id: base }, { id: base + 1 }] })
  if (when.length === 0) return 'scheduled'
  await LocalNotifications.schedule({
    notifications: when.map((at, k) => ({
      id: base + k,
      title: bookingTitle(b),
      body: at === eve ? `Tomorrow at ${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'In one hour',
      schedule: { at, allowWhileIdle: true },
    })),
  })
  return 'scheduled'
}
