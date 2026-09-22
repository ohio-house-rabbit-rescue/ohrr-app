// Staff writes for the Midwest BunFest content: the education programme, the
// rescue directory, and the BunFest side of a company already in the supplier /
// vendor list. See supabase/migrations/20260922120000_bunfest_content.sql.
import { supabase } from '../../lib/supabase'
import type { Database } from '../../lib/database.types'

export type SessionRow = Database['public']['Tables']['bunfest_sessions']['Row']
export type SessionInput = Database['public']['Tables']['bunfest_sessions']['Insert'] & { id?: string }
export type PartnerRow = Database['public']['Tables']['rescue_partners']['Row']
export type PartnerInput = Database['public']['Tables']['rescue_partners']['Insert'] & { id?: string }

export const SESSION_KINDS: { value: SessionRow['kind']; label: string }[] = [
  { value: 'session', label: 'Talk' },
  { value: 'activity', label: 'Activity' },
  { value: 'break', label: 'Break' },
]

/** "13:30" ⟷ "13:30:00" — <input type="time"> gives the short form. */
export function toTime(v: string): string {
  return v.length === 5 ? `${v}:00` : v
}
export function fromTime(v: string | null): string {
  return v ? v.slice(0, 5) : ''
}

/* ------------------------------------------------------------- sessions */

export async function listSessions(orgId: string, year: number): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('bunfest_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('year', year)
    .order('start_time')
  if (error) throw error
  return data ?? []
}

/** Which years have sessions, newest first (so staff can copy last year's). */
export async function sessionYears(orgId: string): Promise<number[]> {
  const { data, error } = await supabase.from('bunfest_sessions').select('year').eq('org_id', orgId)
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.year))].sort((a, b) => b - a)
}

export async function saveSession(s: SessionInput): Promise<SessionRow> {
  const { data, error } = await supabase.from('bunfest_sessions').upsert(s, { onConflict: 'id' }).select('*').single()
  if (error) throw error
  return data
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from('bunfest_sessions').delete().eq('id', id)
  if (error) throw error
}

/** Copy a year's programme into another year, as a starting point. */
export async function copySessions(orgId: string, from: number, to: number): Promise<number> {
  const rows = await listSessions(orgId, from)
  if (rows.length === 0) return 0
  const copies = rows.map((r) => ({
    org_id: orgId,
    year: to,
    start_time: r.start_time,
    end_time: r.end_time,
    title: r.title,
    presenter: r.presenter,
    description: r.description,
    room: r.room,
    kind: r.kind,
    is_published: false, // a copy starts hidden — it's last year's until checked
    sort_order: r.sort_order,
  }))
  const { error } = await supabase.from('bunfest_sessions').insert(copies)
  if (error) throw error
  return copies.length
}

/* ------------------------------------------------------------- partners */

export async function listPartners(orgId: string): Promise<PartnerRow[]> {
  const { data, error } = await supabase
    .from('rescue_partners')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function savePartner(p: PartnerInput): Promise<PartnerRow> {
  const { data, error } = await supabase.from('rescue_partners').upsert(p, { onConflict: 'id' }).select('*').single()
  if (error) throw error
  return data
}

export async function deletePartner(id: string): Promise<void> {
  const { error } = await supabase.from('rescue_partners').delete().eq('id', id)
  if (error) throw error
}

/* --------------------------------------------------------------- booths */

export interface VendorDetails {
  category: string | null
  blurb: string | null
  booth: string | null
  room: 'burgundy' | 'emerald' | null
  tables: number
  published: boolean
  sort: number
}

export async function saveVendorDetails(supplierId: string, d: VendorDetails): Promise<void> {
  const { error } = await supabase.rpc('save_vendor_details', {
    p_id: supplierId,
    p_category: d.category,
    p_blurb: d.blurb,
    p_booth: d.booth,
    p_room: d.room,
    p_tables: d.tables,
    p_published: d.published,
    p_sort: d.sort,
  })
  if (error) throw error
}
