// A set of ids kept in localStorage — the shape behind followed bunnies
// (follow.ts) and saved BunFest sessions (savedSessions.ts). It always works on
// the device alone; when someone is signed in, the account sync
// (features/account/sync.ts) reads it with `list()`, hears changes through
// `subscribe()` and hands back the account's copy with `replace()`.

import { useSyncExternalStore } from 'react'

export interface IdSetStore {
  toggle(id: string): void
  /** Reactive: re-renders on every change. */
  use(): Set<string>
  /** Sorted, for comparing with the account's copy. */
  list(): string[]
  /** Replace the whole set (the account sync's merge result). */
  replace(next: string[]): void
  subscribe(cb: () => void): () => void
}

export function createIdSetStore(key: string): IdSetStore {
  const listeners = new Set<() => void>()
  let ids: Set<string> = load()

  function load(): Set<string> {
    try {
      const raw = localStorage.getItem(key)
      const list = raw ? (JSON.parse(raw) as unknown) : []
      return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
    } catch {
      return new Set()
    }
  }

  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify([...ids]))
    } catch {
      /* private mode / quota — keep working in-memory */
    }
    listeners.forEach((l) => l())
  }

  function subscribe(cb: () => void) {
    listeners.add(cb)
    return () => {
      listeners.delete(cb)
    }
  }

  const getSnapshot = () => ids

  return {
    toggle(id) {
      // New Set reference each change so useSyncExternalStore detects the update.
      const next = new Set(ids)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      ids = next
      persist()
    },
    use() {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    },
    list: () => [...ids].sort(),
    replace(next) {
      ids = new Set(next)
      persist()
    },
    subscribe,
  }
}
