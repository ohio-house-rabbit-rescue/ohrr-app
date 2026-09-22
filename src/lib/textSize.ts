// Text size, chosen once in Settings and kept on the device.
//
// The phone's own "larger text" setting doesn't reach a web view the way it
// reaches a native app, so the app has to offer it itself. Everything in the
// app is sized in rem, so moving the root font size moves the type, the
// spacing and the tap targets together — no separate large-text layout.
import { useSyncExternalStore } from 'react'

export type TextSize = 'normal' | 'large' | 'xlarge'

export const TEXT_SIZES: { value: TextSize; label: string; scale: number }[] = [
  { value: 'normal', label: 'Normal', scale: 1 },
  { value: 'large', label: 'Large', scale: 1.125 },
  { value: 'xlarge', label: 'Extra large', scale: 1.25 },
]

const KEY = 'ohrr:text-size:v1'
const listeners = new Set<() => void>()

function read(): TextSize {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === 'large' || raw === 'xlarge' ? raw : 'normal'
  } catch {
    return 'normal'
  }
}

let size: TextSize = read()

export function scaleOf(s: TextSize): number {
  return TEXT_SIZES.find((t) => t.value === s)?.scale ?? 1
}

/** Put the choice on <html>, which every rem in the app is measured against. */
export function applyTextSize(s: TextSize = size) {
  if (typeof document === 'undefined') return
  const scale = scaleOf(s)
  document.documentElement.style.fontSize = scale === 1 ? '' : `${scale * 100}%`
  document.documentElement.dataset.textSize = s
}

export function setTextSize(s: TextSize) {
  size = s
  try {
    localStorage.setItem(KEY, s)
  } catch {
    /* private mode — the choice just won't survive a restart */
  }
  applyTextSize(s)
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => size

export function useTextSize(): TextSize {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
