// Keeping what people save on their OHRR account (update 31 — `user_saves`).
//
// Signed out, nothing changes: favourites, saved BunFest sessions, My Bunny and
// "last looked" live on the phone exactly as before. Signed in, each of them is
// also one JSON document on the account, so signing in on another phone brings
// them along:
//
//   follows   favourite rabbits              { ids: [...] }
//   sessions  saved BunFest sessions         { ids: [...] }
//   mybunny   My Bunny WITHOUT photos        the ohrr.mybunny.v2 JSON
//   seen      For you's "last looked"        { volunteer: iso, … }
//
// My Bunny's photos follow too (update 32), as files in a private storage
// folder rather than a document: photoSync.ts, run after each full pull and a
// moment after a photo changes on the phone, in the same queue.
//
// How it runs:
//   - On sign-in and on app start (and when the app comes back to the front,
//     at most once a minute), every document is read and merged with the
//     phone's copy. The FIRST sign-in on a phone takes the union of the two;
//     after that a merge knows what the account held at the last sync (the
//     "base", kept per phone), so a deletion on one phone reaches the others
//     instead of coming back.
//   - Every change on the phone is written through: favourites and sessions
//     after a moment, My Bunny and "last looked" after about 2 s of quiet.
//     Before writing, the account's copy is checked; if another phone changed
//     it since, the two are merged first.
//   - Writes go only through save_my_data() (the database caps the size).
//   - The stores keep their own interfaces; this file only reads, listens and
//     hands back the merged copy. On sign-out the phone's copy stays as it is.
//   - Until update 31 is run there is no table: the first read says so, and
//     sync quietly does nothing for the rest of the session.
//
// The My Bunny merge itself is mergeSynced() in features/mybunny/storage.ts.
import { useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import type { Json, UserSaveKind } from '../../lib/database.types'
import { followStore } from '../../lib/follow'
import { savedSessionsStore } from '../../lib/savedSessions'
import type { IdSetStore } from '../../lib/idSetStore'
import {
  applySynced,
  forAccount,
  getMyBunny,
  mergeSynced,
  readSyncBase,
  sanitize,
  subscribeMyBunny,
  syncBaseOf,
  type MyBunnyData,
} from '../mybunny/storage'
import { cancelReminders, resyncReminder } from '../../native/notifications'
import { isNative } from '../../native/platform'
import { mergeSeen, seenStore } from './forYouCounts'
import { isMissing, loadMyEmailPrefs, setDeviceInterests } from './emailList'
import { forgetPhotoSync, syncBunnyPhotos, watchPhotoChanges } from './photoSync'

type Kind = Exclude<UserSaveKind, 'settings'>

interface Channel {
  kind: Kind
  /** How long to wait after a change before writing it. */
  delay: number
  subscribe(cb: () => void): () => void
  /** The phone's copy, as the account stores it. */
  read(): Json
  isEmpty(v: Json): boolean
  /** Phone + account; `base` is what the account held at the last sync here (null: first sign-in on this phone). */
  merge(device: Json, account: Json, base: Json | null): Json
  /** Put a merged copy on the phone. */
  apply(v: Json): void
  /** What to remember about a synced copy for the next merge. */
  base(v: Json): Json
}

const toJson = (v: unknown): Json => JSON.parse(JSON.stringify(v ?? null)) as Json

/** Key-order-free JSON, so "the same" means the same. */
function canon(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(
          Object.keys(val)
            .sort()
            .map((k) => [k, (val as Record<string, unknown>)[k]]),
        )
      : val,
  )
}

/* ---------------------------------------------------------- channels */

function idsOf(v: Json | null): string[] {
  const ids = v && typeof v === 'object' && !Array.isArray(v) ? v.ids : null
  return Array.isArray(ids) ? [...new Set(ids.filter((x): x is string => typeof x === 'string'))].sort() : []
}

/** Union on a first sign-in; after that, what either side removed since the base stays removed. */
export function mergeIds(device: string[], account: string[], base: string[] | null): string[] {
  const all = [...new Set([...device, ...account])]
  if (!base) return all.sort()
  const d = new Set(device)
  const a = new Set(account)
  const b = new Set(base)
  return all.filter((id) => (d.has(id) && a.has(id)) || !b.has(id)).sort()
}

function idChannel(kind: 'follows' | 'sessions', store: IdSetStore): Channel {
  return {
    kind,
    delay: 800,
    subscribe: store.subscribe,
    read: () => ({ ids: store.list() }),
    isEmpty: (v) => idsOf(v).length === 0,
    merge: (d, a, b) => ({ ids: mergeIds(idsOf(d), idsOf(a), b === null ? null : idsOf(b)) }),
    apply: (v) => store.replace(idsOf(v)),
    base: (v) => ({ ids: idsOf(v) }),
  }
}

const myBunnyChannel: Channel = {
  kind: 'mybunny',
  delay: 2000,
  subscribe: subscribeMyBunny,
  read: () => toJson(forAccount(getMyBunny())),
  isEmpty: (v) => sanitize(v).bunnies.length === 0,
  merge: (d, a, b) => toJson(mergeSynced(sanitize(d), sanitize(a), b === null ? null : readSyncBase(b))),
  apply: (v) => {
    const before = getMyBunny()
    applySynced(sanitize(v))
    void followReminders(before, getMyBunny())
  },
  base: (v) => toJson(syncBaseOf(sanitize(v))),
}

const seenChannel: Channel = {
  kind: 'seen',
  delay: 2000,
  subscribe: seenStore.subscribe,
  read: () => toJson(seenStore.get()),
  isEmpty: (v) => Object.keys(seenStore.clean(v)).length === 0,
  // Newest wins per kind, so no base is needed.
  merge: (d, a) => toJson(mergeSeen(seenStore.clean(d), seenStore.clean(a))),
  apply: (v) => seenStore.replace(seenStore.clean(v)),
  base: () => ({}),
}

const CHANNELS: Channel[] = [
  idChannel('follows', followStore),
  idChannel('sessions', savedSessionsStore),
  myBunnyChannel,
  seenChannel,
]

/**
 * Care reminders are scheduled per phone. When another phone's copy removes a
 * reminder, archives its bunny, or moves its date, this phone's pending
 * notifications follow (only those it had scheduled).
 */
async function followReminders(before: MyBunnyData, after: MyBunnyData) {
  if (!isNative) return
  try {
    const archived = new Set(after.bunnies.filter((b) => b.archived).map((b) => b.id))
    const kept = new Map(after.reminders.filter((r) => !archived.has(r.bunnyId)).map((r) => [r.id, r]))
    await cancelReminders(before.reminders.filter((r) => !kept.has(r.id)).map((r) => r.id))
    for (const old of before.reminders) {
      const r = kept.get(old.id)
      if (!r || (r.nextDue === old.nextDue && r.intervalDays === old.intervalDays && r.title === old.title)) continue
      await resyncReminder(r, after.bunnies.find((b) => b.id === r.bunnyId)?.name ?? '')
    }
  } catch {
    /* a notification that can't be moved isn't worth an error */
  }
}

/* ------------------------------------------------------ what's known */

interface KindState {
  /** The account row's updated_at after the last sync here ('' = no row yet). */
  at: string
  base: Json
}
interface SyncState {
  userId: string | null
  kinds: Partial<Record<Kind, KindState>>
}

const STATE_KEY = 'ohrr.account.sync.v1'

function readState(): SyncState {
  try {
    const v = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as SyncState | null
    if (v && typeof v === 'object' && v.kinds && typeof v.kinds === 'object') return v
  } catch {
    /* fall through */
  }
  return { userId: null, kinds: {} }
}

function writeState(s: SyncState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s))
  } catch {
    /* private mode: the next sync merges again, which is safe */
  }
}

/* ---------------------------------------------------------- status */

export type SyncStatus = 'off' | 'syncing' | 'on' | 'unavailable' | 'offline'

let status: { state: SyncStatus; problem: string | null } = { state: 'off', problem: null }
const statusListeners = new Set<() => void>()

function setStatus(state: SyncStatus, problem: string | null = status.problem) {
  if (state === status.state && problem === status.problem) return
  status = { state, problem }
  statusListeners.forEach((l) => l())
}

/** 'unavailable' = update 31 isn't in; `problem` = the last write was refused (too big). */
export function useSyncStatus(): { state: SyncStatus; problem: string | null } {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb)
      return () => {
        statusListeners.delete(cb)
      }
    },
    () => status,
    () => status,
  )
}

/* ---------------------------------------------------------- engine */

let uid: string | null = null
let unavailable = false
let applying = false
let started = false
let lastPull = 0
let queue: Promise<void> = Promise.resolve()
const timers = new Map<Kind, ReturnType<typeof setTimeout>>()
let photoTimer: ReturnType<typeof setTimeout> | null = null

function enqueue(op: () => Promise<void>): Promise<void> {
  queue = queue.then(op).catch(() => setStatus('offline'))
  return queue
}

function start() {
  if (started) return
  started = true
  for (const ch of CHANNELS) ch.subscribe(() => onLocalChange(ch))
  watchPhotoChanges(onPhotoChanged)
}

/** A photo stored or removed on the phone: bring the account's copy into step shortly. */
function onPhotoChanged() {
  if (!uid || unavailable) return
  if (photoTimer) clearTimeout(photoTimer)
  photoTimer = setTimeout(() => {
    photoTimer = null
    const me = uid
    if (me && !unavailable) void enqueue(() => syncBunnyPhotos(me))
  }, 2000)
}

function onLocalChange(ch: Channel) {
  if (applying || !uid || unavailable) return
  const t = timers.get(ch.kind)
  if (t) clearTimeout(t)
  timers.set(
    ch.kind,
    setTimeout(() => {
      timers.delete(ch.kind)
      void enqueue(() => syncKinds([ch]))
    }, ch.delay),
  )
}

/** Read, merge, apply, write back — for these kinds, one after the other. */
async function syncKinds(chs: Channel[]): Promise<void> {
  const me = uid
  if (!me || unavailable || chs.length === 0) return
  setStatus('syncing')
  const { data, error } = await supabase
    .from('user_saves')
    .select('kind, data, updated_at')
    .in(
      'kind',
      chs.map((c) => c.kind),
    )
  if (me !== uid) return
  if (error) {
    if (isMissing(error)) {
      unavailable = true
      setStatus('unavailable')
    } else setStatus('offline')
    return
  }
  let st = readState()
  // Someone else was signed in on this phone before: nothing of theirs is a base for this account.
  if (st.userId !== me) st = { userId: me, kinds: {} }
  let problem: string | null = null
  for (const ch of chs) {
    const row = (data ?? []).find((r) => r.kind === ch.kind)
    const known = st.kinds[ch.kind]
    const device = ch.read()
    // The account hasn't changed since the last sync here: the phone's copy is the newest.
    const merged = !row || (known && known.at === row.updated_at) ? device : ch.merge(device, row.data, known ? known.base : null)
    if (canon(merged) !== canon(device)) {
      applying = true
      try {
        ch.apply(merged)
      } finally {
        applying = false
      }
    }
    let at = row?.updated_at ?? ''
    if (row ? canon(merged) !== canon(row.data) : !ch.isEmpty(merged)) {
      const res = await supabase.rpc('save_my_data', { p_kind: ch.kind, p_data: merged })
      if (me !== uid) return
      if (res.error) {
        if (isMissing(res.error)) {
          unavailable = true
          setStatus('unavailable')
          return
        }
        // Refused as too big: say so, and carry on with the rest. No signal:
        // stop. Either way the phone keeps its copy and tries again on the
        // next change or the next start.
        if (!/too much/i.test(res.error.message)) {
          setStatus('offline')
          return
        }
        problem = res.error.message
        continue
      }
      at = res.data
    }
    st.kinds[ch.kind] = { at, base: ch.base(merged) }
    writeState(st)
  }
  setStatus('on', problem)
}

/** Their email interests, from the account, onto this phone (For you goes by them). */
async function pullInterests(me: string) {
  const prefs = await loadMyEmailPrefs(me)
  if (me === uid && typeof prefs === 'object' && prefs.onList) setDeviceInterests(prefs.interests)
}

/** Everything, now (sign-in, app start, back to the front). */
export function pullAll(): Promise<void> {
  if (!uid || unavailable) return Promise.resolve()
  lastPull = Date.now()
  return enqueue(async () => {
    await syncKinds(CHANNELS)
    // The photos last, once the bunnies they belong to are on the phone.
    const me = uid
    if (me && !unavailable) await syncBunnyPhotos(me)
  })
}

/** Called with the signed-in user's id (null when signed out). */
export function setSyncUser(next: string | null) {
  start()
  if (next === uid) return
  uid = next
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  if (photoTimer) clearTimeout(photoTimer)
  photoTimer = null
  if (!next || !isSupabaseConfigured) {
    setStatus('off', null)
    return
  }
  if (unavailable) {
    setStatus('unavailable')
    return
  }
  void pullAll()
  void pullInterests(next).catch(() => undefined)
}

/** Back in front after a while: pick up what other phones changed (at most once a minute). */
export function pullIfStale() {
  if (Date.now() - lastPull > 60_000) void pullAll()
}

/** Before signing out: write anything still waiting (at most ~3 s). */
export async function flushAccountSync(): Promise<void> {
  if (!uid || unavailable) return
  const waiting = CHANNELS.filter((c) => timers.has(c.kind))
  for (const c of waiting) {
    clearTimeout(timers.get(c.kind))
    timers.delete(c.kind)
  }
  if (waiting.length > 0) void enqueue(() => syncKinds(waiting))
  await Promise.race([queue, new Promise((r) => setTimeout(r, 3000))])
}

/** The account is being deleted: drop anything waiting, and what this phone knew about it. */
export function forgetAccountSync() {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  if (photoTimer) clearTimeout(photoTimer)
  photoTimer = null
  try {
    localStorage.removeItem(STATE_KEY)
  } catch {
    /* private mode */
  }
  forgetPhotoSync()
}
