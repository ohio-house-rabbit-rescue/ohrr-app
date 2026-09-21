// Yearly impact numbers — one row per year, staff-edited, public when
// published. See supabase/migrations/20260921150000_hours_impact.sql.
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export interface ImpactYear {
  org_id: string
  year: number
  adopted: number | null
  taken_in: number | null
  spay_neuter: number | null
  vet_care_cents: number | null
  volunteer_hours: number | null
  fosters: number | null
  bunfest_attendance: number | null
  highlights: string[]
  note: string | null
  is_published: boolean
  updated_at: string
}

/** The big-number tiles, in display order. */
export const IMPACT_FIELDS: { key: keyof ImpactYear; label: string; hint: string; money?: boolean }[] = [
  { key: 'adopted', label: 'Rabbits adopted', hint: 'Adoptions completed in the year' },
  { key: 'taken_in', label: 'Rabbits taken in', hint: 'Rescues, Good Samaritan and owner surrenders admitted' },
  { key: 'spay_neuter', label: 'Spays & neuters', hint: 'Including Fix-a-Bun' },
  { key: 'vet_care_cents', label: 'Spent on vet care', hint: 'Dollars — enter without the $', money: true },
  { key: 'volunteer_hours', label: 'Volunteer hours', hint: 'From the Hours tab, or your own count' },
  { key: 'fosters', label: 'Foster homes', hint: 'Households that fostered at least once' },
  { key: 'bunfest_attendance', label: 'BunFest attendance', hint: 'People through the door' },
]

export async function listPublishedImpact(): Promise<ImpactYear[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase.from('impact_years').select('*').eq('is_published', true).order('year', { ascending: false })
  if (error) throw error
  return (data ?? []) as ImpactYear[]
}

export async function listImpact(orgId: string): Promise<ImpactYear[]> {
  const { data, error } = await supabase.from('impact_years').select('*').eq('org_id', orgId).order('year', { ascending: false })
  if (error) throw error
  return (data ?? []) as ImpactYear[]
}

export async function saveImpact(row: Partial<ImpactYear> & { org_id: string; year: number }, userId: string): Promise<void> {
  const { updated_at: _u, ...rest } = row
  const { error } = await supabase.from('impact_years').upsert({ ...rest, updated_by: userId }, { onConflict: 'org_id,year' })
  if (error) throw error
}

export async function deleteImpact(orgId: string, year: number): Promise<void> {
  const { error } = await supabase.from('impact_years').delete().eq('org_id', orgId).eq('year', year)
  if (error) throw error
}

export function fmtNumber(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}
export function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`
}
