// A lightweight, optional "who am I" store. A visitor can add their email (and
// name) so their saved sessions / followed bunnies stay tied to them and OHRR
// has a way to reach back to them (e.g. about a bunny they're interested in).
//
// Today this lives only on the visitor's device (localStorage), same pattern as
// follow.ts / savedSessions.ts — nothing is transmitted anywhere. A stable
// anonymous `id` is generated on first save so that, WHEN a backend (database)
// is added later, each person's saved data can be upserted and synced across
// devices behind the same interface. `identityPayload()` is the exact shape
// we'd send. Capturing the email is intentionally NOT required to use the app.

import { useSyncExternalStore } from 'react'

export interface Profile {
  id: string
  email: string
  name: string
  updatedAt: string
}

const KEY = 'ohrr:profile:v1'
const listeners = new Set<() => void>()
let profile: Profile | null = load()

function load(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

function persist() {
  try {
    if (profile) localStorage.setItem(KEY, JSON.stringify(profile))
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode / quota — keep working in-memory */
  }
  listeners.forEach((l) => l())
}

function newId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `u_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
  }
}

export function saveProfile(input: { email: string; name?: string }) {
  profile = {
    id: profile?.id ?? newId(),
    email: input.email.trim(),
    name: (input.name ?? profile?.name ?? '').trim(),
    updatedAt: new Date().toISOString(),
  }
  persist()
}

export function clearProfile() {
  profile = null
  persist()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const getSnapshot = () => profile

export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// --- Future backend sync (capability seam) ---------------------------------
// The payload we'd upsert to a database so a person is identifiable by email and
// their saved data is reachable/syncable. Nothing calls a server until that
// backend exists; this documents and centralizes the integration point.
export function identityPayload() {
  return {
    id: profile?.id ?? null,
    email: profile?.email ?? null,
    name: profile?.name ?? null,
    savedSessions: safeList('ohrr:bunfest:saved-sessions:v1'),
    following: safeList('ohrr:following:v1'),
  }
}

function safeList(key: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as string[]
  } catch {
    return []
  }
}
