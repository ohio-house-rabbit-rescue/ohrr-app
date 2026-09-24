// Staff levels, certifications and "My volunteer hours" (update 28 —
// supabase/migrations/20260924220000_staff_levels_and_volunteer_trust.sql).
//
// Four levels, highest first. A level decides who may change whom: nobody can
// change the level, permissions or access of someone at their own level or
// above (founders can manage founders), and the DATABASE enforces it — the UI
// only offers what the database would allow. Founders are owners and board
// members are admins, so everything that checks a role keeps working.
//
// Until update 28 is run none of this exists: useMyLevel() reports ready=false
// and the screens fall back to the owner / admin / staff roles, quietly.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { MembershipRole, StaffLevel } from './database.types'

export type { StaffLevel }

export interface LevelInfo {
  value: StaffLevel
  label: string
  plural: string
  /** One line: what this level means. */
  blurb: string
}

export const LEVELS: LevelInfo[] = [
  { value: 'founder', label: 'Founder', plural: 'Founders', blurb: 'Everything, including who is on the board' },
  { value: 'board', label: 'Board', plural: 'Board', blurb: 'Everything; looks after leads and workers' },
  { value: 'lead', label: 'Lead', plural: 'Leads', blurb: 'Coordinators with the permissions their job needs' },
  { value: 'worker', label: 'Worker', plural: 'Workers', blurb: 'One job, e.g. the Hop Shop counter' },
]

export function levelInfo(level: StaffLevel): LevelInfo {
  return LEVELS.find((l) => l.value === level) ?? LEVELS[2]
}

/** Mirrors level_rank() in the migration. */
export function levelRank(level: StaffLevel | null | undefined): number {
  return level === 'founder' ? 4 : level === 'board' ? 3 : level === 'lead' ? 2 : level === 'worker' ? 1 : 0
}

/** Founders and board members hold every permission (they're owners and admins). */
export function isFullAccess(level: StaffLevel): boolean {
  return level === 'founder' || level === 'board'
}

/** The level someone with only a role has — what the migration gave everyone already here. */
export function levelFromRole(role: MembershipRole): StaffLevel {
  return role === 'owner' ? 'founder' : role === 'admin' ? 'board' : 'lead'
}

/** The role that goes with a level (set_member_level keeps them in step). */
export function roleForLevel(level: StaffLevel): MembershipRole {
  return level === 'founder' ? 'owner' : level === 'board' ? 'admin' : 'staff'
}

/** The levels this person may give (or invite at): anything below their own; founders, any. */
export function levelsICanGive(mine: StaffLevel | null | undefined): StaffLevel[] {
  if (!mine) return []
  if (mine === 'founder') return LEVELS.map((l) => l.value)
  return LEVELS.filter((l) => levelRank(l.value) < levelRank(mine)).map((l) => l.value)
}

/** Shown on a person the signed-in member can't change. */
export function managedBy(level: StaffLevel): string {
  return isFullAccess(level) ? 'Managed by a founder' : 'Managed by the board'
}

/** An access preset that points to a level when inviting (the website does the same). */
export const PRESET_SUGGESTED_LEVEL: Record<string, StaffLevel> = {
  'Hop Shop Worker': 'worker',
  'Counter volunteer': 'worker',
}

/* --------------------------------------------------------- certifications */

/** The ones OHRR signs people off for most; anything else is typed in. */
export const CERT_KINDS: { value: string; label: string }[] = [
  { value: 'hop-shop', label: 'Hop Shop counter' },
  { value: 'buncare', label: 'Buncare orientation' },
  { value: 'animal-handling', label: 'Animal handling' },
  { value: 'vet-transport', label: 'Vet transport' },
]

export function certLabel(kind: string): string {
  return CERT_KINDS.find((k) => k.value === kind)?.label ?? kind
}

/** Today in the device's own time zone, as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** How close a certification is to running out. "soon" = within 30 days. */
export function certExpiry(expiresOn: string | null): { state: 'none' | 'ok' | 'soon' | 'expired'; text: string } {
  if (!expiresOn) return { state: 'none', text: 'No expiry' }
  const days = Math.round((Date.parse(`${expiresOn}T12:00:00`) - Date.parse(`${todayIso()}T12:00:00`)) / 86_400_000)
  if (days < 0) return { state: 'expired', text: `Expired ${shortDate(expiresOn)}` }
  if (days === 0) return { state: 'soon', text: 'Expires today' }
  if (days <= 30) return { state: 'soon', text: `Expires in ${days} day${days === 1 ? '' : 's'}` }
  return { state: 'ok', text: `Valid until ${shortDate(expiresOn)}` }
}

/* ------------------------------------------------------------ my level */

// One probe per person and org for the whole session (the dashboard and the
// menu both ask): their own membership's `level`. Like the website, update 28
// counts as in once that column exists — nothing here calls
// my_staff_volunteer_page(), which would make a volunteer record. "No such
// column" is remembered; any other failure (no signal) is tried again next time.
const probes = new Map<string, Promise<{ ready: boolean; level: StaffLevel | null }>>()

/** PostgREST's "that function doesn't exist" — the update hasn't been run. */
export function isMissingFunction(e: { code?: string; message?: string } | null | undefined): boolean {
  return e?.code === 'PGRST202' || /could not find the function|schema cache/i.test(e?.message ?? '')
}

/** "column memberships.level does not exist" — the update hasn't been run. */
function isMissingColumn(e: { code?: string; message?: string } | null | undefined): boolean {
  return e?.code === '42703' || e?.code === 'PGRST204' || /does not exist|schema cache/i.test(e?.message ?? '')
}

function probe(userId: string, orgId: string) {
  const key = `${userId}:${orgId}`
  let p = probes.get(key)
  if (!p) {
    p = Promise.resolve(
      supabase.from('memberships').select('level').eq('org_id', orgId).eq('user_id', userId).eq('status', 'active').maybeSingle(),
    )
      .then(({ data, error }) => {
        if (error && !isMissingColumn(error)) probes.delete(key)
        return { ready: !error, level: error ? null : (data?.level ?? null) }
      })
      .catch(() => {
        probes.delete(key)
        return { ready: false, level: null }
      })
    probes.set(key, p)
  }
  return p
}

/** The signed-in person's level, and whether update 28 is in (ready). */
export function useMyLevel(userId: string | null | undefined, orgId: string | null | undefined): { ready: boolean; level: StaffLevel | null } {
  const [state, setState] = useState<{ key: string; ready: boolean; level: StaffLevel | null } | null>(null)
  const key = userId && orgId ? `${userId}:${orgId}` : ''
  useEffect(() => {
    if (!userId || !orgId) return
    let alive = true
    void probe(userId, orgId).then((r) => {
      if (alive) setState({ key: `${userId}:${orgId}`, ...r })
    })
    return () => {
      alive = false
    }
  }, [userId, orgId])
  return state && state.key === key ? { ready: state.ready, level: state.level } : { ready: false, level: null }
}

/* ------------------------------------------------- my volunteer hours */

// my_staff_volunteer_page() makes the volunteer record the first time, so it
// runs once at a time (a double effect mustn't try to make two).
const pages = new Map<string, Promise<string>>()

/** The signed-in staff member's own volunteer-page token (made for them if needed). */
export function myStaffVolunteerToken(userId: string, orgId: string): Promise<string> {
  const key = `${userId}:${orgId}`
  let p = pages.get(key)
  if (!p) {
    p = Promise.resolve(supabase.rpc('my_staff_volunteer_page', { p_org: orgId })).then(({ data, error }) => {
      if (error) throw error
      if (!data) throw new Error('Your volunteer page couldn’t be opened.')
      return data
    })
    p.catch(() => pages.delete(key))
    pages.set(key, p)
  }
  return p
}
