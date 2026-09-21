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
