// Reading and writing volunteer calls — see calls.ts for what a call is, and
// supabase/migrations/20260923120000_volunteer_calls.sql for the database.
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import type { Call, Helper, HoursFor } from './calls'

export type CallRow = Database['public']['Tables']['volunteer_calls']['Row']
export type OpenCall = Database['public']['Functions']['volunteer_calls_open']['Returns'][number]
export type RosterLine = Database['public']['Functions']['call_roster']['Returns'][number]
export type SignUpResult = Database['public']['Functions']['sign_up_for_call']['Returns']

/* ------------------------------------------------------------ public */

export async function loadPublicCall(slug: string): Promise<Call | null> {
  const { data, error } = await supabase.rpc('volunteer_call_public', { p_slug: slug })
  if (error) throw error
  return (data as Call | null) ?? null
}

export async function listOpenCalls(): Promise<OpenCall[]> {
  const { data, error } = await supabase.rpc('volunteer_calls_open')
  if (error) throw error
  return data ?? []
}

export interface SignUp {
  slug: string
  slotIds: string[]
  name: string
  email: string
  phone: string
  area: string
  hoursFor: HoursFor | ''
  details: Record<string, string>
  source: string | null
  attested: boolean
}

export async function signUpForCall(s: SignUp): Promise<SignUpResult> {
  const { data, error } = await supabase.rpc('sign_up_for_call', {
    p_slug: s.slug,
    p_slot_ids: s.slotIds,
    p_name: s.name,
    p_email: s.email,
    p_phone: s.phone || null,
    p_area: s.area || null,
    p_hours_for: s.hoursFor || null,
    p_details: s.details,
    p_source: s.source,
    p_attested: s.attested,
  })
  if (error) throw error
  return data as SignUpResult
}

/* ------------------------------------------------------------ staff */

export async function listCalls(orgId: string): Promise<CallRow[]> {
  const { data, error } = await supabase
    .from('volunteer_calls')
    .select('*')
    .eq('org_id', orgId)
    .order('on_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function loadCall(id: string): Promise<CallRow | null> {
  const { data, error } = await supabase.from('volunteer_calls').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** Save the call and (re)make its shifts. */
export async function saveCall(orgId: string, call: Partial<CallRow>): Promise<{ id: string; slug: string; shifts: number; orphaned: number }> {
  const { data, error } = await supabase.rpc('save_volunteer_call', { p_org: orgId, p_call: call })
  if (error) throw error
  return data as { id: string; slug: string; shifts: number; orphaned: number }
}

/**
 * Who can sign up for a call: approved volunteers of one kind, or anyone
 * (null). The database copies it onto the call's shifts. Returns false when
 * the database doesn't have the setting yet (before update 25) — then
 * everyone can sign up, as before.
 */
export async function setCallApproval(id: string, role: string | null): Promise<boolean> {
  const { error } = await supabase.from('volunteer_calls').update({ approval_role: role }).eq('id', id)
  if (error) {
    if (/approval_role|schema cache/i.test(error.message ?? '')) return false
    throw error
  }
  return true
}

export async function deleteCall(id: string): Promise<void> {
  const { error } = await supabase.from('volunteer_calls').delete().eq('id', id)
  if (error) throw error
}

export async function callRoster(callId: string): Promise<RosterLine[]> {
  const { data, error } = await supabase.rpc('call_roster', { p_call: callId })
  if (error) throw error
  return data ?? []
}

export async function callThanks(callId: string): Promise<Helper[]> {
  const { data, error } = await supabase.rpc('call_thanks', { p_call: callId })
  if (error) throw error
  return (data ?? []) as Helper[]
}

export async function markThanked(callId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('mark_thanked', { p_call: callId, p_email: email })
  if (error) throw error
}

export async function callSources(callId: string): Promise<{ source: string; people: number }[]> {
  const { data, error } = await supabase.rpc('call_sources', { p_call: callId })
  if (error) throw error
  return data ?? []
}

/** Present, or didn't come — the same statuses the shift roster uses. */
export async function setAttendance(bookingId: string, status: 'checked_in' | 'no_show' | 'confirmed'): Promise<void> {
  const { error } = await supabase.rpc('mark_call_attendance', { p_booking: bookingId, p_status: status })
  if (error) throw error
}

export async function addWalkIn(slotId: string, name: string, email: string, phone: string, area: string): Promise<void> {
  const { error } = await supabase.rpc('add_walk_in', {
    p_slot_id: slotId,
    p_name: name,
    p_email: email,
    p_phone: phone || null,
    p_area: area || null,
  })
  if (error) throw error
}

/** What each volunteer said their hours are for, keyed by lower-case email. */
export async function hoursForByEmail(orgId: string, emails: string[]): Promise<Record<string, HoursFor | null>> {
  if (emails.length === 0) return {}
  const { data, error } = await supabase
    .from('volunteers')
    .select('email, hours_for')
    .eq('org_id', orgId)
    .in('email', emails)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((v) => [(v.email ?? '').toLowerCase(), v.hours_for]))
}
