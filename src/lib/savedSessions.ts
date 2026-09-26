// A tiny "saved sessions" store for the BunFest schedule. Lets a visitor build
// a personal day at the festival — pick the talks they want and come back to
// them — persisted to localStorage on their own device, no login needed. Same
// shape as ./follow.ts: when someone is signed in, their saved sessions are
// also kept on their OHRR account (features/account/sync.ts).

import { createIdSetStore } from './idSetStore'

/** Read and replaced by the account sync; the rest of the app uses the two functions below. */
export const savedSessionsStore = createIdSetStore('ohrr:bunfest:saved-sessions:v1')

export function toggleSavedSession(id: string) {
  savedSessionsStore.toggle(id)
}

export function useSavedSessions(): Set<string> {
  return savedSessionsStore.use()
}
