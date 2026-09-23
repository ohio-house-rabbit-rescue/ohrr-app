// What a counter or door phone keeps on itself, so it keeps working when the
// signal drops: the org it works for, its name ("Door 1"), the item list, the
// door's ticket list, and anything waiting to be sent. Plain localStorage —
// small, survives a reload, and every read or write is allowed to fail
// (private mode) without breaking the screen.

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode or full — the screen still works for this visit */
  }
}

/** An id made on the phone, so a sale or a check-in sent twice is still one. */
export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/* ------------------------------------------------ this phone */

const DEVICE_KEY = 'ohrr.counter.device.v1'

export interface DeviceInfo {
  /** "Door 1", "Hop Shop till" — shown on every entry it records. */
  name: string
  /** The org this phone works for, remembered for when it can't ask. */
  orgId: string | null
}

export function getDevice(): DeviceInfo {
  return readLocal<DeviceInfo>(DEVICE_KEY, { name: '', orgId: null })
}

export function setDevice(d: Partial<DeviceInfo>): DeviceInfo {
  const next = { ...getDevice(), ...d }
  writeLocal(DEVICE_KEY, next)
  return next
}

/* ------------------------------------------------ money */

export const money = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

/** "12", "12.5", "12.50" → cents; anything else → null. */
export function toCents(s: string): number | null {
  const t = s.trim()
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null
  return Math.round(parseFloat(t) * 100)
}

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
