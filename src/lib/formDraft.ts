// A long form that survives an interruption.
//
// OHRR's forms are long by necessity (the surrender intake is nine steps), and
// they are filled in on a phone — where a call, a notification or a switched
// app can take the screen away mid-answer. Every keystroke is kept on the
// device under a per-form key and restored next time; the draft is cleared the
// moment the form is sent.
//
// Local only: nothing is sent to OHRR until the person taps Send.
import { useEffect, useState } from 'react'

const PREFIX = 'ohrr.draft.'

function read<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return initial
    const saved = JSON.parse(raw) as T
    // Merge so a form that gained a field since the draft was saved still works.
    return saved && typeof saved === 'object' && !Array.isArray(saved)
      ? { ...(initial as object), ...(saved as object) } as T
      : saved
  } catch {
    return initial
  }
}

/**
 * `useState` that remembers. Returns the usual [value, setValue] plus `clear()`
 * for when the form has been sent, and `restored` — true when this session
 * started from a saved draft, so the form can say so.
 */
export function useFormDraft<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void, boolean] {
  const [restored] = useState(() => {
    try {
      return localStorage.getItem(PREFIX + key) !== null
    } catch {
      return false
    }
  })
  const [value, setValue] = useState<T>(() => read(key, initial))

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* private mode / quota — the form still works, it just won't be kept */
    }
  }, [key, value])

  const clear = () => {
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      /* nothing to do */
    }
  }

  return [value, setValue, clear, restored]
}

/** The one-line note a form shows when it picked a draft back up. */
export const DRAFT_NOTE = 'Picked up where you left off — this form is saved on your phone as you type.'
