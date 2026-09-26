// "For you" — what's new since someone last looked, for the things they ticked
// (their email interests, on the account or on this phone):
//
//   volunteer  new published volunteer calls that haven't happened yet
//   events     new published events that haven't happened yet
//   adoptions  rabbits newly listed for adoption
//   bunfest    new talks on the BunFest schedule
//
// "New" = created after they last looked at that kind, and in the last two
// weeks at most (someone who ticks Events today isn't told about a year of
// them). "Last looked" is kept per kind on this phone and, signed in, on the
// account too (user_saves kind 'seen' — see sync.ts), so a phone that's been
// looked at clears the badge on the others.
//
// Counts come from each table's created_at, a head-only count per kind, kept
// for five minutes so Home and the top bar share one set of requests.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { IconName } from '../../components/icons'
import { getDeviceInterests, useDeviceInterests, type Interest } from './emailList'

export type ForYouKey = Extract<Interest, 'volunteer' | 'events' | 'adoptions' | 'bunfest'>

interface Kind {
  key: ForYouKey
  to: string
  icon: IconName
  label: (n: number) => string
}

export const FOR_YOU: Kind[] = [
  { key: 'volunteer', to: '/volunteer', icon: 'users', label: (n) => `${n} new volunteer call${n === 1 ? '' : 's'}` },
  { key: 'events', to: '/events', icon: 'calendar', label: (n) => `${n} new event${n === 1 ? '' : 's'}` },
  {
    key: 'adoptions',
    to: '/adopt',
    icon: 'heart',
    label: (n) => (n === 1 ? '1 rabbit newly up for adoption' : `${n} rabbits newly up for adoption`),
  },
  { key: 'bunfest', to: '/bunfest/schedule', icon: 'star', label: (n) => `${n} new talk${n === 1 ? '' : 's'} at Midwest BunFest` },
]

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000
const FRESH_MS = 5 * 60 * 1000

/* ----------------------------------------------------- last looked */

export type Seen = Partial<Record<ForYouKey, string>>

const SEEN_KEY = 'ohrr.forYou.seen.v1'
const seenListeners = new Set<() => void>()
let seen: Seen = readSeen()

function cleanSeen(raw: unknown): Seen {
  const out: Seen = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const k of FOR_YOU.map((f) => f.key)) {
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) out[k] = v
  }
  return out
}

function readSeen(): Seen {
  try {
    return cleanSeen(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'))
  } catch {
    return {}
  }
}

function writeSeen(next: Seen) {
  seen = next
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
  seenListeners.forEach((l) => l())
}

/** Newest wins, per kind — what two phones' "last looked" add up to. */
export function mergeSeen(a: Seen, b: Seen): Seen {
  const out: Seen = { ...a }
  for (const [k, v] of Object.entries(b) as [ForYouKey, string][]) {
    if (!out[k] || v > out[k]!) out[k] = v
  }
  return out
}

/** For the account sync: read, listen, and take the account's copy. */
export const seenStore = {
  get: (): Seen => seen,
  clean: cleanSeen,
  subscribe(cb: () => void) {
    seenListeners.add(cb)
    return () => {
      seenListeners.delete(cb)
    }
  },
  replace(next: Seen) {
    const before = JSON.stringify(seen)
    writeSeen(cleanSeen(next))
    // Someone looked on another phone: count again.
    if (JSON.stringify(seen) !== before) invalidate()
  },
}

/** They've looked: nothing of these kinds is new any more. */
export function markSeen(...keys: ForYouKey[]) {
  const now = new Date().toISOString()
  const next = { ...seen }
  for (const k of keys) next[k] = now
  writeSeen(next)
  for (const k of keys) counts[k] = { n: 0, at: Date.now() }
  countListeners.forEach((l) => l())
}

/**
 * On a screen that shows everything of that kind: mark it seen when it opens.
 * Only when they ticked it — otherwise every visit to Events would sync a
 * timestamp nobody uses.
 */
export function useMarkSeen(key: ForYouKey) {
  useEffect(() => {
    if (getDeviceInterests().includes(key)) markSeen(key)
  }, [key])
}

/* ------------------------------------------------------------ counts */

const counts: Partial<Record<ForYouKey, { n: number; at: number }>> = {}
const inflight = new Set<ForYouKey>()
const countListeners = new Set<() => void>()
let version = 0

function invalidate() {
  for (const k of Object.keys(counts) as ForYouKey[]) delete counts[k]
  version += 1
  countListeners.forEach((l) => l())
}

function sinceFor(key: ForYouKey): string {
  const floor = Date.now() - TWO_WEEKS_MS
  const last = seen[key] ? Date.parse(seen[key]!) : 0
  return new Date(Math.max(floor, last)).toISOString()
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function countNew(key: ForYouKey): Promise<number | null> {
  const since = sinceFor(key)
  const now = new Date().toISOString()
  const head = { count: 'exact' as const, head: true }
  const q =
    key === 'volunteer'
      ? supabase.from('volunteer_calls').select('id', head).eq('is_published', true).gt('created_at', since).gte('on_date', localToday())
      : key === 'events'
        ? supabase.from('events').select('id', head).eq('is_published', true).gt('created_at', since).gte('starts_at', now)
        : key === 'adoptions'
          ? supabase.from('rabbits').select('id', head).eq('is_published', true).gt('created_at', since)
          : supabase.from('bunfest_sessions').select('id', head).eq('is_published', true).eq('kind', 'session').gt('created_at', since)
  try {
    const { count, error } = await q
    return error ? null : (count ?? 0)
  } catch {
    return null
  }
}

async function refresh(keys: ForYouKey[]) {
  if (!isSupabaseConfigured) return
  const due = keys.filter((k) => !inflight.has(k) && !(counts[k] && Date.now() - counts[k]!.at < FRESH_MS))
  if (due.length === 0) return
  due.forEach((k) => inflight.add(k))
  const results = await Promise.all(due.map(async (k) => [k, await countNew(k)] as const))
  for (const [k, n] of results) {
    inflight.delete(k)
    // No signal: keep what we had, and don't ask again for a few minutes.
    counts[k] = { n: n ?? counts[k]?.n ?? 0, at: Date.now() }
  }
  countListeners.forEach((l) => l())
}

function subscribeCounts(cb: () => void) {
  countListeners.add(cb)
  return () => {
    countListeners.delete(cb)
  }
}
let snapshot = { version: -1, key: '', value: {} as Partial<Record<ForYouKey, number>> }
function getCounts(): Partial<Record<ForYouKey, number>> {
  const key = FOR_YOU.map((f) => `${f.key}:${counts[f.key]?.n ?? ''}`).join()
  if (snapshot.key !== key || snapshot.version !== version) {
    snapshot = {
      version,
      key,
      value: Object.fromEntries(FOR_YOU.filter((f) => counts[f.key]).map((f) => [f.key, counts[f.key]!.n])),
    }
  }
  return snapshot.value
}

export interface ForYouItem {
  key: ForYouKey
  count: number
  label: string
  to: string
  icon: IconName
}

/** What's new for this person; empty when they ticked none of these, or nothing's new. */
export function useForYou(): { items: ForYouItem[]; total: number } {
  const interests = useDeviceInterests()
  const current = useSyncExternalStore(subscribeCounts, getCounts, getCounts)
  const kinds = FOR_YOU.filter((f) => interests.includes(f.key))
  const wanted = kinds.map((k) => k.key).join()
  useEffect(() => {
    if (wanted) void refresh(wanted.split(',') as ForYouKey[])
    // `version` changes when another phone's "last looked" arrives.
  }, [wanted, current])
  const items = kinds
    .map((k) => ({ key: k.key, count: current[k.key] ?? 0, label: k.label(current[k.key] ?? 0), to: k.to, icon: k.icon }))
    .filter((i) => i.count > 0)
  return { items, total: items.reduce((n, i) => n + i.count, 0) }
}
