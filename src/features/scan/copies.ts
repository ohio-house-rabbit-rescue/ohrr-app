// How many copies of each label to print by default: one for the item label, and one for the box
// label, each remembered on this device until changed. Shown as a "Copies" line next to the label
// size wherever a label prints (Receive into boxes, Receive items, the box labels), so going from
// one label to two or more is a tap on + and back is a tap on −.
import { useState } from 'react'

export type CopiesKind = 'item' | 'box'

export const MAX_DEFAULT_COPIES = 10

const key = (kind: CopiesKind) => `ohrr.labels.copies.${kind}`

const clamp = (n: number) => Math.min(MAX_DEFAULT_COPIES, Math.max(1, Math.round(n) || 1))

export function loadCopies(kind: CopiesKind): number {
  try {
    return clamp(Number(localStorage.getItem(key(kind))))
  } catch {
    return 1
  }
}

export function saveCopies(kind: CopiesKind, n: number): number {
  const v = clamp(n)
  try {
    localStorage.setItem(key(kind), String(v))
  } catch {
    /* private mode: it still applies until the page is closed */
  }
  return v
}

/** [copies, setCopies] — the saved default, changed and saved in one go. */
export function useCopies(kind: CopiesKind): [number, (n: number) => void] {
  const [n, setN] = useState(() => loadCopies(kind))
  return [n, (v: number) => setN(saveCopies(kind, v))]
}
