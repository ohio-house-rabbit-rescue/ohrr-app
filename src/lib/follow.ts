// A tiny, account-free "follow" store. Lets a visitor follow bunnies they care
// about so they come back to check on them — persisted to localStorage on their
// own device, no login or backend required. If/when real accounts arrive, this
// can be swapped for a server-backed store behind the same hook.

import { useSyncExternalStore } from 'react'

const KEY = 'ohrr:following:v1'
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

export function toggleFollow(id: string) {
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

export function useFollowing(): Set<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
