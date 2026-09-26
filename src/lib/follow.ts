// A tiny "follow" store. Lets a visitor follow bunnies they care about so they
// come back to check on them — persisted to localStorage on their own device,
// no login needed. When someone is signed in, their follows are also kept on
// their OHRR account (features/account/sync.ts) behind the same hook.

import { createIdSetStore } from './idSetStore'

/** Read and replaced by the account sync; the rest of the app uses the two functions below. */
export const followStore = createIdSetStore('ohrr:following:v1')

export function toggleFollow(id: string) {
  followStore.toggle(id)
}

export function useFollowing(): Set<string> {
  return followStore.use()
}
