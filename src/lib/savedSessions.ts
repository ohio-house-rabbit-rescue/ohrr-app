// A tiny, account-free "saved sessions" store for the BunFest schedule. Lets a
// visitor build a personal day at the festival — pick the talks they want and
// come back to them — persisted to localStorage on their own device, no login
// or backend required. Same shape as ./follow.ts; if real accounts arrive later,
// swap the storage for a server-backed one behind the same hook.

import { useSyncExternalStore } from 'react'

const KEY = 'ohrr:bunfest:saved-sessions:v1'
const listeners = new Set<() => void>()
let ids: Set<string> = load()

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch {
    /* private mode / quota — keep working in-memory */
  }
  listeners.forEach((l) => l())
}

export function toggleSavedSession(id: string) {
  // New Set reference each change so useSyncExternalStore detects the update.
  const next = new Set(ids)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  ids = next
  persist()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => ids

export function useSavedSessions(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
