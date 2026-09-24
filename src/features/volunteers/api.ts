// Volunteers: the roster staff keep, and the private record a volunteer can
// open on their own phone.
//
// A volunteer has no account — the app has no public sign-in — so their record
// is reached by a private token, the same idea as a booking's cancel link.
// Staff hand it over as a link or a QR code from Staff → Volunteers; the phone
// remembers it. See supabase/migrations/20260922140000_*.sql.
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'
import { APP_URL } from '../mybunny/ics'
import type { UpcomingItem } from './approval'

export type VolunteerRow = Database['public']['Tables']['volunteers']['Row']
export type VolunteerInput = Database['public']['Tables']['volunteers']['Insert'] & { id?: string }
export type HoursRow = Database['public']['Tables']['volunteer_hours_entries']['Row']

export const VOLUNTEER_STATUS: { value: VolunteerRow['status']; label: string }[] = [
  { value: 'prospect', label: 'Interested' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Taking a break' },
  { value: 'former', label: 'No longer volunteering' },
]

/** The roles OHRR actually runs, offered as tick boxes (free text is allowed too). */
export const VOLUNTEER_ROLES = [
  'Bunny Socialization',
  'Buncare',
  'Vet transport',
  'Field rescue',
  'Events & fundraising',
  'Hop Shop',
  'Foster',
  'Photography',
  'Admin & marketing',
]

export function statusLabel(s: VolunteerRow['status']): string {
  return VOLUNTEER_STATUS.find((x) => x.value === s)?.label ?? s
}

/** The private link a volunteer opens to see and log their own hours. */
export function hoursUrl(token: string): string {
  const base = APP_URL.replace(/\/my-bunny\/?$/, '')
  return `${base}/volunteer/hours/${token}`
}

/** The app's Volunteer screen, where approved volunteers pick a shift. */
export function volunteerPageUrl(): string {
  return `${APP_URL.replace(/\/my-bunny\/?$/, '')}/volunteer`
}

/* ----------------------------------------------------------------- staff */

export async function listVolunteers(orgId: string): Promise<VolunteerRow[]> {
  const { data, error } = await supabase
    .from('volunteers')
    .select('*')
    .eq('org_id', orgId)
    .order('status')
    .order('name')
  if (error) throw error
  return data ?? []
}

/** Before update 25 runs there are no approval columns; the rest still saves. */
const noApprovalColumns = (e: { message?: string } | null) => /approved_for|review_status|reviewed_(at|by)|schema cache/i.test(e?.message ?? '')

export async function saveVolunteer(v: VolunteerInput): Promise<VolunteerRow> {
  let { data, error } = await supabase.from('volunteers').upsert(v, { onConflict: 'id' }).select('*').single()
  if (error && 'approved_for' in v && noApprovalColumns(error)) {
    const rest = { ...v }
    delete rest.approved_for
    ;({ data, error } = await supabase.from('volunteers').upsert(rest, { onConflict: 'id' }).select('*').single())
  }
  if (error || !data) throw error ?? new Error('Could not save that volunteer.')
  // Pull in any hours already recorded against the same email address. A
  // failure here is not worth losing the save over.
  try {
    await supabase.rpc('link_volunteer_hours', { p_volunteer: data.id })
  } catch {
    /* the roster row is saved either way */
  }
  return data
}

/* ------------------------------------------- applications (update 25) */

/** Approve someone who applied: they can sign up for `approvedFor` (['*'] = everything). */
export async function approveVolunteer(id: string, userId: string | null, approvedFor: string[]): Promise<void> {
  const { error } = await supabase
    .from('volunteers')
    .update({
      status: 'active',
      approved_for: approvedFor,
      review_status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
    })
    .eq('id', id)
  if (error) throw error
}

export async function declineVolunteer(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('volunteers')
    .update({ review_status: 'declined', reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq('id', id)
  if (error) throw error
}

/** How many applications are waiting (0 before update 25 runs). */
export async function countApplications(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('volunteers')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('review_status', 'pending')
  return error ? 0 : (count ?? 0)
}

export async function deleteVolunteer(id: string): Promise<void> {
  const { error } = await supabase.from('volunteers').delete().eq('id', id)
  if (error) throw error
}

/** Every hours entry for one volunteer (staff view — logged and confirmed). */
export async function volunteerHours(volunteerId: string): Promise<HoursRow[]> {
  const { data, error } = await supabase
    .from('volunteer_hours_entries')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .order('on_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Hours a volunteer logged that staff haven't confirmed yet, across the org. */
export async function unconfirmedHours(orgId: string): Promise<HoursRow[]> {
  const { data, error } = await supabase
    .from('volunteer_hours_entries')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'logged')
    .order('on_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function setHoursStatus(entryId: string, status: 'logged' | 'confirmed'): Promise<void> {
  const { error } = await supabase.rpc('set_hours_status', { p_entry: entryId, p_status: status })
  if (error) throw error
}

export async function deleteHoursEntry(id: string): Promise<void> {
  const { error } = await supabase.from('volunteer_hours_entries').delete().eq('id', id)
  if (error) throw error
}

/* ------------------------------------------------------ a volunteer's own */

export interface MyHoursEntry {
  id: string
  on_date: string
  hours: number
  activity: string
  status: 'logged' | 'confirmed'
  /** 'shift': a shift they were checked in to (update 25) — it can't be removed here. */
  source: 'self' | 'staff' | 'checkin' | 'shift'
  note: string | null
}

export interface MyRecord {
  id: string
  name: string
  email: string | null
  status: VolunteerRow['status']
  roles: string[]
  started_on: string | null
  orientation_on: string | null
  entries: MyHoursEntry[]
  totals: { all: number; confirmed: number; this_year: number; this_month: number; this_week: number; today: number }
  by_year: { year: number; hours: number }[]
  // From update 25 on (undefined before it runs):
  /** What they may sign up for; '*' = everything. */
  approved_for?: string[]
  review_status?: 'pending' | 'approved' | 'declined' | null
  hours_for?: VolunteerRow['hours_for']
  letter_details?: Record<string, string> | null
  /** What they're signed up for, soonest first. */
  upcoming?: UpcomingItem[]
}

/** Read a volunteer's own record by their private token. null = bad link. */
export async function myRecord(token: string): Promise<MyRecord | null> {
  const { data, error } = await supabase.rpc('my_volunteer_record', { p_token: token })
  if (error) throw error
  return (data as unknown as MyRecord | null) ?? null
}

export async function logMyHours(
  token: string,
  i: { onDate: string; hours: number; activity: string; note?: string },
): Promise<void> {
  const { error } = await supabase.rpc('log_my_hours', {
    p_token: token,
    p_on_date: i.onDate,
    p_hours: i.hours,
    p_activity: i.activity,
    p_note: i.note ?? null,
  })
  if (error) throw error
}

export async function deleteMyHours(token: string, entryId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_my_hours', { p_token: token, p_entry: entryId })
  if (error) throw error
}

/* --------------------------------------------------------------- helpers */

export const HOURS_ACTIVITIES = [
  'Bunny Socialization',
  'Buncare',
  'Vet transport',
  'Field rescue',
  'Event help',
  'Hop Shop',
  'Fostering',
  'Behind the scenes',
]

/** "12.5 hours" / "1 hour" / "30 minutes" */
export function hoursLabel(h: number): string {
  if (!h) return '0 hours'
  if (h < 1) return `${Math.round(h * 60)} minutes`
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ${h === 1 ? 'hour' : 'hours'}`
}

/** The device remembers the link once it has been opened. */
const TOKEN_KEY = 'ohrr:volunteer:token:v1'

export function rememberToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* private mode — they'll use the link again */
  }
}
export function savedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* nothing to do */
  }
}
