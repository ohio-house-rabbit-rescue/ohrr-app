// The new Hop Shop item, kept on this device while it's being filled in, so
// leaving the page (a phone call, looking something up, another staff page)
// doesn't lose it. It opens again where it was; Add item or Cancel clears it.
// Local only, like the public forms' drafts (lib/formDraft.ts).
const PREFIX = 'ohrr.draft.hopshop.new.'
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

interface Kept<T> {
  at: number
  value: T
}

export function readNewItemDraft<T>(orgId: string): T | null {
  if (!orgId) return null
  try {
    const raw = localStorage.getItem(PREFIX + orgId)
    if (!raw) return null
    const kept = JSON.parse(raw) as Kept<T>
    if (!kept || typeof kept.at !== 'number' || Date.now() - kept.at > MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + orgId)
      return null
    }
    return kept.value
  } catch {
    return null
  }
}

export function writeNewItemDraft<T>(orgId: string, value: T): void {
  if (!orgId) return
  try {
    localStorage.setItem(PREFIX + orgId, JSON.stringify({ at: Date.now(), value } satisfies Kept<T>))
  } catch {
    /* private mode / quota — the form still works, it just won't be kept */
  }
}

export function clearNewItemDraft(orgId: string): void {
  try {
    localStorage.removeItem(PREFIX + orgId)
  } catch {
    /* nothing to do */
  }
}
