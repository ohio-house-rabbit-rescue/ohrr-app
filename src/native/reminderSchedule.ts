// Pure helpers for turning a My Bunny reminder into local-notification slots.
// No imports, no browser access — exercised by scripts/mybunny-check.ts.
//
// A reminder gets a stable numeric "base" (from its string id) and up to
// SLOTS_PER_REMINDER notification ids: base * 8 + k. Android needs a 32-bit
// signed int for the id, so the base is kept to 28 bits.

export const REMIND_HOUR = 9
export const REMIND_MINUTE = 0
/** How many future occurrences of a repeating reminder are scheduled at once. */
export const OCCURRENCES = 6
export const SLOTS_PER_REMINDER = 8

/** FNV-1a 32-bit hash of the reminder id, truncated to 28 bits (so base*8 < 2^31). */
export function notificationBase(reminderId: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < reminderId.length; i++) {
    h ^= reminderId.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h & 0x0fffffff
}

/** Every notification id a reminder could be using (used to cancel / detect). */
export function notificationIds(reminderId: string): number[] {
  const base = notificationBase(reminderId) * SLOTS_PER_REMINDER
  return Array.from({ length: SLOTS_PER_REMINDER }, (_, k) => base + k)
}

/** Local 09:00 on a YYYY-MM-DD, shifted by `plusDays`. Invalid dates give null. */
export function localMorning(iso: string, plusDays = 0): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mo < 1 || mo > 12 || day < 1 || day > 31) return null
  const d = new Date(y, mo - 1, day + plusDays, REMIND_HOUR, REMIND_MINUTE, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** The next 09:00 strictly after `now` (today's if we're still before it, else tomorrow's). */
export function nextMorning(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), REMIND_HOUR, REMIND_MINUTE, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 1)
  return d
}

export interface ScheduleSource {
  /** YYYY-MM-DD */
  nextDue: string
  /** Repeat every N days, or null for a one-off. */
  intervalDays: number | null
}

/**
 * When to fire: 09:00 local on nextDue, then (for repeats) the following
 * occurrences up to `count` in total. An overdue reminder — or one due today
 * after 09:00 — gets a nudge at the next 09:00 instead of a time in the past,
 * followed by whichever later occurrences are still ahead.
 */
export function occurrenceTimes(r: ScheduleSource, now: Date = new Date(), count = OCCURRENCES): Date[] {
  const first = localMorning(r.nextDue)
  if (!first) return []
  const out: Date[] = [first > now ? first : nextMorning(now)]
  const every = r.intervalDays && r.intervalDays >= 1 ? Math.round(r.intervalDays) : null
  if (every) {
    for (let k = 1; out.length < count && k < 5000; k++) {
      const t = localMorning(r.nextDue, k * every)
      if (!t) break
      if (t > now && t.getTime() > out[out.length - 1].getTime()) out.push(t)
    }
  }
  return out
}

/** "9:00 AM Fri, Oct 3" — for the confirmation line under the button. */
export function formatFireTime(d: Date): string {
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${time} ${day}`
}
