// OHRR's email list (update 31 — the `mailing_list` table). One list, six
// things to hear about; the same labels and consent line on the website.
//
//   not signed in  join_mailing_list(): adds the ticked interests to that
//                  address (never removes any), source 'app'
//   signed in      save_my_email_prefs(): the account's own address, and
//                  replaces their choices; their row reads back with a select
//
// Whatever someone ticks is also remembered on this phone (DEVICE_KEY), which
// is what "For you" on Home goes by — signed in or not.
//
// Until update 31 is run the table and functions don't exist: callers get
// `missing` back and fall back to today's behaviour.
import { useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { submitRequest } from '../../lib/requests'

export const INTERESTS = [
  { key: 'volunteer', label: 'Volunteer opportunities' },
  { key: 'events', label: 'Events' },
  { key: 'bunfest', label: 'Midwest BunFest' },
  { key: 'adoptions', label: 'Rabbits up for adoption' },
  { key: 'hopshop', label: 'Hop Shop news' },
  { key: 'newsletter', label: 'OHRR news' },
] as const

export type Interest = (typeof INTERESTS)[number]['key']

export const INTEREST_LABEL = Object.fromEntries(INTERESTS.map((i) => [i.key, i.label])) as Record<Interest, string>

export const CONSENT_LINE = 'OHRR will email you about what you tick. Every email has a link to change this or stop.'

export function isInterest(v: unknown): v is Interest {
  return typeof v === 'string' && INTERESTS.some((i) => i.key === v)
}

/** Only known interests, once each, in the list's order. */
export function cleanInterests(list: readonly unknown[]): Interest[] {
  return INTERESTS.map((i) => i.key).filter((k) => list.includes(k))
}

/** PostgREST: the table or function isn't there (update 31 not run yet). */
export function isMissing(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  return (
    e.code === 'PGRST205' ||
    e.code === 'PGRST202' ||
    e.code === '42P01' ||
    e.code === '42883' ||
    /schema cache|does not exist|could not find the (table|function)/i.test(e.message ?? '')
  )
}

/* -------------------------------------------- interests on this phone */

const DEVICE_KEY = 'ohrr.interests.v1'
const listeners = new Set<() => void>()
let deviceInterests: Interest[] = loadDevice()

function loadDevice(): Interest[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? cleanInterests(raw) : []
  } catch {
    return []
  }
}

/** Remember what was ticked on this phone (For you goes by it). */
export function setDeviceInterests(list: readonly Interest[]) {
  const next = cleanInterests(list)
  if (next.join() === deviceInterests.join()) return
  deviceInterests = next
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(next))
  } catch {
    /* private mode — keep it in memory */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => deviceInterests

export const getDeviceInterests = (): Interest[] => deviceInterests

export function useDeviceInterests(): Interest[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* ------------------------------------------------------------ joining */

/**
 * Join the list without an account. Falls back to the old Inbox request
 * ('mailing-list') while update 31 isn't in, so nobody's sign-up is lost.
 * Throws a friendly message on failure.
 */
export async function joinMailingList(input: {
  name: string
  email: string
  interests: Interest[]
  source?: string
  /** Extra fields for the Inbox fallback (the old form's first / last name). */
  fallbackFields?: Record<string, string>
}): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('This build isn’t connected to OHRR yet.')
  const email = input.email.trim()
  const interests = cleanInterests(input.interests)
  setDeviceInterests(interests)
  const { error } = await supabase.rpc('join_mailing_list', {
    p_name: input.name.trim() || null,
    p_email: email,
    p_interests: interests,
    p_source: input.source ?? 'app',
  })
  if (!error) return
  if (!isMissing(error)) throw new Error(error.message || 'Could not sign you up right now.')
  await submitRequest('mailing-list', {
    name: input.name.trim(),
    email,
    ...(input.fallbackFields ?? {}),
    interests: interests.map((i) => INTEREST_LABEL[i]).join(', '),
  })
}

/* ------------------------------------------------- signed-in choices */

export interface MyEmailPrefs {
  interests: Interest[]
  subscribed: boolean
  /** True when they have a row on the list at all. */
  onList: boolean
}

/**
 * Their own row (RLS returns only rows with their user_id). `missing` = update
 * 31 isn't in; `error` = couldn't ask (no signal).
 */
export async function loadMyEmailPrefs(userId: string): Promise<MyEmailPrefs | 'missing' | 'error'> {
  const { data, error } = await supabase
    .from('mailing_list')
    .select('interests, unsubscribed_at')
    .eq('user_id', userId)
    .limit(1)
  if (error) return isMissing(error) ? 'missing' : 'error'
  const row = data?.[0]
  if (!row) return { interests: [], subscribed: false, onList: false }
  return { interests: cleanInterests(row.interests ?? []), subscribed: row.unsubscribed_at === null, onList: true }
}

/** Save their choices (the account's own address). Throws a friendly message. */
export async function saveMyEmailPrefs(interests: Interest[], subscribed: boolean, name?: string | null): Promise<void> {
  const clean = cleanInterests(interests)
  const { error } = await supabase.rpc('save_my_email_prefs', {
    p_interests: clean,
    p_subscribed: subscribed,
    p_name: name?.trim() || null,
  })
  if (error) throw new Error(isMissing(error) ? 'Email choices open after OHRR’s next update.' : error.message)
  setDeviceInterests(clean)
}
