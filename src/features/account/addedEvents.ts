// Events someone added to their calendar from this phone ("Add to calendar"
// on Events, BunFest and Visit). Kept on the phone only, like saved sessions,
// so "Remind me on this phone" can nudge them the morning of. Past events are
// dropped a day after they start.
import { useSyncExternalStore } from 'react'
import type { EventItem } from '../../data/events'

const KEY = 'ohrr.events.added.v1'
const KEEP_AFTER_MS = 24 * 60 * 60 * 1000

export interface AddedEvent {
  slug: string
  title: string
  startsAt: string
  venue?: string
}

const listeners = new Set<() => void>()
let items: AddedEvent[] = load()

function prune(list: AddedEvent[]): AddedEvent[] {
  const cutoff = Date.now() - KEEP_AFTER_MS
  return list.filter((e) => e && e.slug && !Number.isNaN(Date.parse(e.startsAt)) && Date.parse(e.startsAt) > cutoff)
}

function load(): AddedEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? prune(raw as AddedEvent[]) : []
  } catch {
    return []
  }
}

/** Called when someone picks a way to add an event to their calendar. */
export function rememberAddedEvent(e: EventItem) {
  const next: AddedEvent = { slug: e.slug, title: e.title, startsAt: e.startsAt, ...(e.venue ? { venue: e.venue } : {}) }
  items = prune([...items.filter((x) => x.slug !== e.slug), next])
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
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
const getSnapshot = () => items

export function useAddedEvents(): AddedEvent[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
