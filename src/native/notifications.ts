// "Remind me on this phone" — local notifications for My Bunny care reminders
// inside the Android / iOS app. The web app keeps its .ics calendar download;
// a native WebView can't hand a blob download to the calendar app, and a local
// notification is what people expect from an installed app anyway.
//
// Nothing here talks to a server: the notifications are scheduled on the
// device by the OS and fire even when the app is closed. Every function is a
// no-op on the web (returns 'unsupported' / false / void).

import type { Reminder } from '../features/mybunny/storage'
import { isNative } from './platform'
import { notificationIds, occurrenceTimes, OCCURRENCES } from './reminderSchedule'

export type ScheduleOutcome =
  | { status: 'scheduled'; count: number; first: Date }
  | { status: 'denied' }
  | { status: 'unsupported' }

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  return LocalNotifications
}

/**
 * Ask for the notification permission if it hasn't been decided yet. Android 13+
 * and iOS show a system prompt once; after a refusal the person has to flip it in
 * the phone's Settings, so callers show a hint when this returns false.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative) return false
  const ln = await plugin()
  let { display } = await ln.checkPermissions()
  if (display === 'prompt' || display === 'prompt-with-rationale') {
    display = (await ln.requestPermissions()).display
  }
  return display === 'granted'
}

/** Schedule 09:00 notifications for a reminder (the next OCCURRENCES for a repeat). */
export async function scheduleReminder(r: Reminder, bunnyName: string): Promise<ScheduleOutcome> {
  if (!isNative) return { status: 'unsupported' }
  if (!(await ensureNotificationPermission())) return { status: 'denied' }
  const ln = await plugin()
  const ids = notificationIds(r.id)
  // Start clean so an edit never leaves a stale slot behind.
  await ln.cancel({ notifications: ids.map((id) => ({ id })) })
  const times = occurrenceTimes(r, new Date(), OCCURRENCES)
  if (times.length === 0) return { status: 'scheduled', count: 0, first: new Date() }
  const body = r.notes?.trim() || `Due today for ${bunnyName}. Open My Bunny to mark it done.`
  await ln.schedule({
    notifications: times.map((at, k) => ({
      id: ids[k],
      title: `${r.title} — ${bunnyName}`,
      body,
      schedule: { at, allowWhileIdle: true },
      extra: { reminderId: r.id, bunnyId: r.bunnyId },
    })),
  })
  return { status: 'scheduled', count: times.length, first: times[0] }
}

/** Cancel every pending notification for one reminder (safe if none exist). */
export async function cancelReminder(reminderId: string): Promise<void> {
  if (!isNative) return
  const ln = await plugin()
  await ln.cancel({ notifications: notificationIds(reminderId).map((id) => ({ id })) })
}

/** Cancel for several reminders at once — e.g. everything for an archived or removed bunny. */
export async function cancelReminders(reminderIds: string[]): Promise<void> {
  if (!isNative || reminderIds.length === 0) return
  const ln = await plugin()
  const notifications = reminderIds.flatMap((rid) => notificationIds(rid).map((id) => ({ id })))
  await ln.cancel({ notifications })
}

/** True when this reminder has at least one notification pending on this phone. */
export async function isReminderScheduled(reminderId: string): Promise<boolean> {
  if (!isNative) return false
  const ln = await plugin()
  const ids = new Set(notificationIds(reminderId))
  const { notifications } = await ln.getPending()
  return notifications.some((n) => ids.has(n.id))
}

/**
 * After "Mark done" or an edit: if the reminder was being reminded on this
 * phone, re-schedule it from its new next-due date; otherwise leave it alone.
 */
export async function resyncReminder(r: Reminder | undefined, bunnyName: string): Promise<void> {
  if (!isNative || !r) return
  if (await isReminderScheduled(r.id)) await scheduleReminder(r, bunnyName)
}
