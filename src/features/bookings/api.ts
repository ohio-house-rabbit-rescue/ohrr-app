// Supabase calls for bookings. Public calls need no sign-in; the staff ones
// are gated on `bookings.manage` in the database.
import { supabase } from '../../lib/supabase'
import type { BookingReceipt, BookingStatus, BookingType, OpenSlot, RosterRow } from './types'

export async function getBookingType(slug: string): Promise<BookingType | null> {
  const { data, error } = await supabase.from('booking_types').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return (data as BookingType | null) ?? null
}

export async function listBookingTypes(orgId?: string): Promise<BookingType[]> {
  let q = supabase.from('booking_types').select('*').order('sort_order')
  if (orgId) q = q.eq('org_id', orgId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as BookingType[]
}

export async function openSlots(slug: string, days = 60): Promise<OpenSlot[]> {
  const { data, error } = await supabase.rpc('booking_slots_open', {
    p_slug: slug,
    p_from: new Date().toISOString(),
    p_to: new Date(Date.now() + days * 86_400_000).toISOString(),
  })
  if (error) throw error
  return (data ?? []) as OpenSlot[]
}

export interface BookInput {
  slotId: string
  name: string
  email: string
  phone: string
  party: number
  answer?: string
  notes?: string
  attested: boolean
}

export async function bookSlot(i: BookInput): Promise<BookingReceipt> {
  const { data, error } = await supabase.rpc('book_slot', {
    p_slot_id: i.slotId,
    p_name: i.name,
    p_email: i.email,
    p_phone: i.phone,
    p_party: i.party,
    p_answer: i.answer ?? null,
    p_notes: i.notes ?? null,
    p_attested: i.attested,
    p_source: 'app',
  })
  if (error) throw error
  return data as unknown as BookingReceipt
}

export async function bookingByToken(token: string): Promise<BookingReceipt | null> {
  const { data, error } = await supabase.rpc('booking_by_token', { p_token: token })
  if (error) throw error
  return (data as unknown as BookingReceipt | null) ?? null
}

export async function cancelBooking(token: string): Promise<BookingReceipt | null> {
  const { data, error } = await supabase.rpc('cancel_booking', { p_token: token })
  if (error) throw error
  return (data as unknown as BookingReceipt | null) ?? null
}

/* ------------------------------------------------------------ staff */

export async function saveBookingType(t: Partial<BookingType> & { org_id: string; slug: string; name: string }): Promise<BookingType> {
  const { data, error } = await supabase.from('booking_types').upsert(t, { onConflict: 'org_id,slug' }).select('*').single()
  if (error) throw error
  return data as BookingType
}

export async function generateSlots(i: {
  typeId: string
  from: string
  to: string
  weekdays: number[]
  start: string
  end: string
  capacity: number | null
  note: string | null
}): Promise<number> {
  const { data, error } = await supabase.rpc('generate_booking_slots', {
    p_type_id: i.typeId,
    p_from: i.from,
    p_to: i.to,
    p_weekdays: i.weekdays,
    p_start: i.start,
    p_end: i.end,
    p_capacity: i.capacity,
    p_note: i.note,
  })
  if (error) throw error
  return (data as number) ?? 0
}

export async function roster(orgId: string, from: Date, to: Date): Promise<RosterRow[]> {
  const { data, error } = await supabase.rpc('booking_roster', {
    p_org: orgId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
  if (error) throw error
  return (data ?? []) as RosterRow[]
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.rpc('set_booking_status', { p_id: id, p_status: status })
  if (error) throw error
}

export interface SlotRow {
  id: string
  type_id: string
  starts_at: string
  ends_at: string
  capacity: number
  note: string | null
  is_open: boolean
}

export async function listSlots(typeId: string, from: Date, to: Date): Promise<SlotRow[]> {
  const { data, error } = await supabase
    .from('booking_slots')
    .select('id,type_id,starts_at,ends_at,capacity,note,is_open')
    .eq('type_id', typeId)
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at')
  if (error) throw error
  return (data ?? []) as SlotRow[]
}

export async function setSlotOpen(id: string, open: boolean): Promise<void> {
  const { error } = await supabase.from('booking_slots').update({ is_open: open }).eq('id', id)
  if (error) throw error
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await supabase.from('booking_slots').delete().eq('id', id)
  if (error) throw error
}

/* ------------------------------------------------------------ volunteer hours */

export interface HoursSummaryRow {
  email: string
  name: string | null
  total_hours: number
  shifts: number
  last_date: string
}
export interface HoursLine {
  source: 'shift' | 'manual'
  on_date: string
  hours: number
  activity: string
  ref_id: string
}

export async function hoursSummary(orgId: string, from: string, to: string): Promise<HoursSummaryRow[]> {
  const { data, error } = await supabase.rpc('volunteer_hours_summary', { p_org: orgId, p_from: from, p_to: to })
  if (error) throw error
  return ((data ?? []) as HoursSummaryRow[]).map((r) => ({ ...r, total_hours: Number(r.total_hours) }))
}

export async function hoursHistory(orgId: string, email: string, from: string, to: string): Promise<HoursLine[]> {
  const { data, error } = await supabase.rpc('volunteer_history', { p_org: orgId, p_email: email, p_from: from, p_to: to })
  if (error) throw error
  return ((data ?? []) as HoursLine[]).map((r) => ({ ...r, hours: Number(r.hours) }))
}

export async function addHours(orgId: string, userId: string, e: { email: string; name: string; on_date: string; hours: number; activity: string }): Promise<void> {
  const { error } = await supabase.from('volunteer_hours_entries').insert({ org_id: orgId, added_by: userId, ...e, email: e.email.trim().toLowerCase() })
  if (error) throw error
}

export async function deleteHours(id: string): Promise<void> {
  const { error } = await supabase.from('volunteer_hours_entries').delete().eq('id', id)
  if (error) throw error
}

export async function hoursTotalForYear(orgId: string, year: number): Promise<number> {
  const { data, error } = await supabase.rpc('volunteer_hours_total', { p_org: orgId, p_year: year })
  if (error) throw error
  return Number(data ?? 0)
}
