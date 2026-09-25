// Staff levels, certifications and "My volunteer hours" (update 28 —
// supabase/migrations/20260924220000_staff_levels_and_volunteer_trust.sql),
// widened to ten levels by update 30 (20260925100000_staff_tiers_and_sharing.sql).
//
// Ten levels. A level decides who may change whom: founders and developers may
// change anyone but themselves; everyone else only people below their own rank.
// You can only give a level below your own (founders and developers: any), and
// only share tasks you hold yourself. The DATABASE enforces all of it — the UI
// only offers what the database would allow. Founders and developers are owners
// with every task; everyone else, Board and Admins included, holds exactly the
// tasks switched on for them. Access can also end on a date (access_until,
// America/New_York), except a founder's or developer's.
//
// Until update 28 is run none of this exists: useMyLevel() reports ready=false
// and the screens fall back to the owner / admin / staff roles, quietly. Between
// 28 and 30 only the old four levels exist (founder, board, lead, worker) and
// Board is an admin underneath, with every task.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { MembershipRole, StaffLevel } from './database.types'

export type { StaffLevel }

export interface LevelInfo {
  value: StaffLevel
  label: string
  /** The Team list's heading for a group of them. */
  plural: string
  /** "Make Bev <a board member>?" */
  asA: string
  /** One line: what this level means. */
  blurb: string
}

const ADMIN_BLURB = 'Office and operations, with the tasks switched on'

/** The levels, highest first (the order the pickers and the Team list use). */
export const LEVELS: LevelInfo[] = [
  { value: 'developer', label: 'Developer', plural: 'Developers', asA: 'a developer', blurb: 'Every task; builds and maintains the app and website' },
  { value: 'founder', label: 'Founder', plural: 'Founders', asA: 'a founder', blurb: 'Every task, and looks after everyone' },
  { value: 'board', label: 'Board', plural: 'Board', asA: 'a board member', blurb: 'The board: oversight and approvals, plus any tasks added' },
  { value: 'admin3', label: 'Admin 3', plural: 'Admin 3', asA: 'Admin 3', blurb: ADMIN_BLURB },
  { value: 'admin2', label: 'Admin 2', plural: 'Admin 2', asA: 'Admin 2', blurb: ADMIN_BLURB },
  { value: 'admin1', label: 'Admin 1', plural: 'Admin 1', asA: 'Admin 1', blurb: ADMIN_BLURB },
  { value: 'lead', label: 'Lead', plural: 'Leads', asA: 'a lead', blurb: 'Runs an area and can share its tasks' },
  { value: 'volunteer3', label: 'Volunteer 3', plural: 'Volunteer 3', asA: 'Volunteer 3', blurb: 'A trusted volunteer; their hours count straight away' },
  { value: 'volunteer2', label: 'Volunteer 2', plural: 'Volunteer 2', asA: 'Volunteer 2', blurb: 'A few chosen tasks' },
  { value: 'volunteer1', label: 'Volunteer 1', plural: 'Volunteer 1', asA: 'Volunteer 1', blurb: 'One job, e.g. the Counter' },
]

/** Before update 30 the lowest level was 'worker' (the update makes it Volunteer 1). */
const WORKER: LevelInfo = { value: 'worker', label: 'Volunteer', plural: 'Volunteers', asA: 'a volunteer', blurb: 'One job, e.g. the Counter' }

/** Every level the database may hand back, highest first — the ten, then the old 'worker'. */
export const ALL_LEVELS: LevelInfo[] = [...LEVELS, WORKER]

/** The four levels before update 30 (then Board was an admin, with every task). */
export const LEGACY_LEVELS: StaffLevel[] = ['founder', 'board', 'lead', 'worker']

/** The admin levels have no preset: their tasks are chosen one by one. */
export const ADMIN_LEVELS: StaffLevel[] = ['admin1', 'admin2', 'admin3']

/** Who may be offered "Can bring on helpers" (invite and manage people below them). */
export const HELPER_LEVELS: StaffLevel[] = ['lead', 'admin1', 'admin2', 'admin3', 'board']

export function levelInfo(level: StaffLevel): LevelInfo {
  return ALL_LEVELS.find((l) => l.value === level) ?? WORKER
}

/** Mirrors level_rank() in update 30 (the old four keep their order; 'worker' ranks as Volunteer 1). */
export function levelRank(level: StaffLevel | null | undefined): number {
  switch (level) {
    case 'developer':
      return 10
    case 'founder':
      return 9
    case 'board':
      return 8
    case 'admin3':
      return 7
    case 'admin2':
      return 6
    case 'admin1':
      return 5
    case 'lead':
      return 4
    case 'volunteer3':
      return 3
    case 'volunteer2':
      return 2
    case 'volunteer1':
    case 'worker':
      return 1
    default:
      return 0
  }
}

/**
 * Founders and developers hold every task (they're owners). Before update 30,
 * Board did too (an admin underneath) — the Team screen checks the role as well.
 */
export function isFullAccess(level: StaffLevel): boolean {
  return level === 'founder' || level === 'developer'
}

/** The level someone with only a role has (before update 28) — what the migrations gave everyone already here. */
export function levelFromRole(role: MembershipRole): StaffLevel {
  return role === 'owner' ? 'founder' : role === 'admin' ? 'board' : 'lead'
}

/** The role that goes with a level (set_member_level keeps them in step). */
export function roleForLevel(level: StaffLevel): MembershipRole {
  return isFullAccess(level) ? 'owner' : 'staff'
}

/**
 * The levels this person may give (or invite at), highest first: anything
 * below their own; founders and developers, any. Before update 30
 * (tiers = false), only the old four.
 */
export function levelsICanGive(mine: StaffLevel | null | undefined, tiers = true): StaffLevel[] {
  if (!mine) return []
  const offered = tiers ? LEVELS : ALL_LEVELS.filter((l) => LEGACY_LEVELS.includes(l.value))
  if (isFullAccess(mine)) return offered.map((l) => l.value)
  return offered.filter((l) => levelRank(l.value) < levelRank(mine)).map((l) => l.value)
}

/** Shown on a person the signed-in member can't change. */
export function managedBy(level: StaffLevel): string {
  return isFullAccess(level) ? 'Managed by a founder or developer' : 'Managed by someone above their level'
}

/**
 * The level an access preset points to when inviting (the website does the
 * same). Picking the preset moves the level there, if the inviter may give it.
 * Admin 1–3 have no preset.
 */
export const PRESET_SUGGESTED_LEVEL: Record<string, StaffLevel> = {
  Board: 'board',
  'Adoptions Coordinator': 'lead',
  'Volunteer Lead': 'lead',
  'Hop Shop Manager': 'lead',
  'Content Editor': 'lead',
  'BunFest & Events': 'lead',
  'Inbox helper': 'volunteer3',
  'Content Approver': 'volunteer3',
  'Care pages helper': 'volunteer2',
  'Rabbit listings helper': 'volunteer2',
  'Counter volunteer': 'volunteer1',
  'Hop Shop Worker': 'volunteer1',
}

/* ------------------------------------------------------ access that ends */

/** Today in Ohio (America/New_York) as YYYY-MM-DD — the day the database counts access by. */
export function ohrrToday(): string {
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return todayIso()
  }
}

/** Has access that ran until `until` ended? (It lasts through that whole day.) */
export function accessEnded(until: string | null | undefined): boolean {
  return Boolean(until) && String(until) < ohrrToday()
}

/** "Oct 3" (with the year when it isn't this one) — the Team badge. */
export function accessDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "Saturday, October 3, 2026" — in a sentence. */
export function accessDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/* ------------------------------------------------ is update 30 in yet? */

// level_rank('developer') is 0 before update 30 and 10 after. Remembered for
// the session once known; a failure (no signal) is tried again next time.
let tiersProbe: Promise<boolean> | null = null

/** Whether update 30 (ten levels, sharing, end dates) has been run. */
export function probeTiers(): Promise<boolean> {
  if (!tiersProbe) {
    const p: Promise<boolean> = Promise.resolve(supabase.rpc('level_rank', { p_level: 'developer' }))
      .then(({ data, error }) => {
        if (error) {
          if (tiersProbe === p) tiersProbe = null
          return false
        }
        return data === 10
      })
      .catch(() => {
        if (tiersProbe === p) tiersProbe = null
        return false
      })
    tiersProbe = p
  }
  return tiersProbe
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
export function isMissingColumn(e: { code?: string; message?: string } | null | undefined): boolean {
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
