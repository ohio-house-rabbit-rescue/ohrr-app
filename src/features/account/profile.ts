// A signed-in person's own name (update 31 — `user_profiles`). The top bar
// greets them by it, so the last one seen is kept on this phone too and the
// greeting doesn't wait for the network. Before update 31 there's no table:
// the name just stays empty and nothing complains.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { isMissing } from './emailList'

const KEY = 'ohrr.account.name.v1'
/** A name typed on "Create account" before there was a session to save it with. */
const PENDING_KEY = 'ohrr.account.pendingName.v1'

interface Known {
  userId: string
  name: string
}

const listeners = new Set<() => void>()
let known: Known | null = read()
const loaded = new Set<string>()

function read(): Known | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Known | null
    return v && typeof v.userId === 'string' && typeof v.name === 'string' ? v : null
  } catch {
    return null
  }
}

function set(next: Known | null) {
  known = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => known

/** Their name ('' when none yet); loads it once per session. */
export function useMyName(userId: string | null | undefined): string {
  const k = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => {
    if (userId) void loadMyName(userId)
  }, [userId])
  return userId && k?.userId === userId ? k.name : ''
}

/** The first word of their name — what the top bar shows. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

async function loadMyName(userId: string) {
  if (!isSupabaseConfigured || loaded.has(userId)) return
  loaded.add(userId)
  const { data, error } = await supabase.from('user_profiles').select('name').eq('user_id', userId).maybeSingle()
  if (error) {
    if (!isMissing(error)) loaded.delete(userId) // no signal: try again next time
    return
  }
  const name = data?.name?.trim() ?? ''
  if (!name) {
    // A name typed when the account was made, before there was a session.
    const pending = readPending()
    if (pending) {
      clearPending()
      await saveMyName(userId, pending).catch(() => undefined)
      return
    }
  }
  set({ userId, name })
}

/** Save their name. Throws a friendly message. */
export async function saveMyName(userId: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, 120)
  const { error } = await supabase.from('user_profiles').upsert({ user_id: userId, name: clean || null })
  if (error) throw new Error(isMissing(error) ? 'Names can be saved after OHRR’s next update.' : error.message)
  set({ userId, name: clean })
}

export function rememberPendingName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(PENDING_KEY, name.trim().slice(0, 120))
  } catch {
    /* private mode */
  }
}
function readPending(): string {
  try {
    return localStorage.getItem(PENDING_KEY) ?? ''
  } catch {
    return ''
  }
}
function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    /* private mode */
  }
}
