// Bookings — shifts and appointments booked in-house (replaces SignUp.com
// and the old appointment form). See supabase/migrations/20260921110000_bookings.sql.

export type BookingKind = 'shift' | 'appointment'
export type BookingStatus = 'requested' | 'confirmed' | 'cancelled' | 'checked_in' | 'no_show'

export interface BookingType {
  id: string
  org_id: string
  slug: string
  name: string
  kind: BookingKind
  description: string | null
  requirements: string | null
  location: string | null
  duration_min: number
  capacity: number
  max_party: number
  min_lead_hours: number
  max_per_month: number | null
  confirm_mode: 'auto' | 'staff'
  ask_reason: string | null
  attest_text: string | null
  is_published: boolean
  sort_order: number
  /** Standing weekly schedule; the database keeps `auto_weeks` weeks of times filled from it. */
  weekly: WeeklyRule[]
  auto_weeks: number
}

/** One line of a weekly schedule: "Sat + Sun, 1:30–2:30 pm, 4 people". `days`: 0 = Sunday. */
export interface WeeklyRule {
  days: number[]
  /** "13:30" */
  start: string
  /** "14:30" */
  end: string
  capacity?: number | null
  label?: string | null
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "9:00 AM" from "09:00". */
export function fmtClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

/** "Mon–Fri" / "Sat + Sun" / "Tue, Thu" for a rule's days. */
export function fmtDays(days: number[]): string {
  const d = [...new Set(days)].filter((x) => x >= 0 && x <= 6).sort((a, b) => a - b)
  if (d.length === 0) return '—'
  if (d.length === 7) return 'Every day'
  const consecutive = d.every((x, i) => i === 0 || x === d[i - 1] + 1)
  if (consecutive && d.length >= 3) return `${WEEKDAY_SHORT[d[0]]}–${WEEKDAY_SHORT[d[d.length - 1]]}`
  return d.map((x) => WEEKDAY_SHORT[x]).join(d.length === 2 ? ' + ' : ', ')
}

/** One line per rule, for the Set up list and the public page. */
export function fmtWeekly(rules: WeeklyRule[]): string[] {
  return rules
    .filter((r) => r && Array.isArray(r.days) && r.start && r.end)
    .map((r) => `${fmtDays(r.days)} ${fmtClock(r.start)}–${fmtClock(r.end)}${r.label ? ` · ${r.label}` : ''}`)
}

export interface OpenSlot {
  slot_id: string
  starts_at: string
  ends_at: string
  capacity: number
  taken: number
  note: string | null
}

/** What book_slot / booking_by_token return. */
export interface BookingReceipt {
  booking_id: string
  status: BookingStatus
  cancel_token?: string
  name?: string
  type_name: string
  kind: BookingKind
  location: string | null
  starts_at: string
  ends_at: string
  party_size: number
}

export interface RosterRow {
  booking_id: string
  status: BookingStatus
  name: string
  email: string
  phone: string | null
  party_size: number
  answer: string | null
  notes: string | null
  attested: boolean
  created_at: string
  slot_id: string
  starts_at: string
  ends_at: string
  capacity: number
  type_id: string
  type_name: string
  type_slug: string
  kind: BookingKind
  confirm_mode: 'auto' | 'staff'
}

export const OHRR_TZ = 'America/New_York'

export function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: OHRR_TZ })
}
export function fmtDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: OHRR_TZ })
}
export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: OHRR_TZ })
}
export function fmtRange(startIso: string, endIso: string): string {
  return `${fmtTime(startIso)} – ${fmtTime(endIso)}`
}
/** YYYY-MM-DD in OHRR's zone, for grouping slots by day. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: OHRR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  return parts
}

export function statusLabel(s: BookingStatus): string {
  switch (s) {
    case 'requested':
      return 'Waiting for OHRR to confirm'
    case 'confirmed':
      return 'Confirmed'
    case 'cancelled':
      return 'Cancelled'
    case 'checked_in':
      return 'Checked in'
    case 'no_show':
      return 'No show'
  }
}

export function durationLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} hour${min === 60 ? '' : 's'}`
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`
  return `${min} minutes`
}
