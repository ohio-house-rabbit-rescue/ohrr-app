// "My bookings", kept on this device.
//
// OHRR sends no confirmation email (there is no mail service in the stack), so
// until now the only record of a booked shift was the confirmation screen: close
// the app and the time, the place and the private cancel link were gone. Every
// booking made on this phone is now remembered here — the same account-free,
// localStorage-only approach as saved sessions and followed bunnies — and shown
// as a card on Home, Volunteer and Services.
//
// Nothing here ever leaves the device; the booking itself lives in the database
// and is re-read by its token so a staff confirmation or cancellation shows up.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { bookingByToken } from './api'
import type { BookingReceipt, BookingStatus, BookingType } from './types'

const KEY = 'ohrr:bookings:mine:v1'
/** Forget a booking a day after it ends — it stops being useful. */
const KEEP_AFTER_END_MS = 24 * 60 * 60 * 1000

export interface MyBooking {
  token: string
  bookingId: string
  typeName: string
  typeSlug: string
  kind: 'shift' | 'appointment'
  location: string | null
  startsAt: string
  endsAt: string
  partySize: number
  status: BookingStatus
  savedAt: string
}

const listeners = new Set<() => void>()
let items: MyBooking[] = load()

function load(): MyBooking[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as MyBooking[]) : []
    return Array.isArray(list) ? prune(list) : []
  } catch {
    return []
  }
}

function prune(list: MyBooking[]): MyBooking[] {
  const cutoff = Date.now() - KEEP_AFTER_END_MS
  return list
    .filter((b) => b && b.token && new Date(b.endsAt).getTime() > cutoff && b.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

function persist(next: MyBooking[]) {
  items = next
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* private mode / quota — keep working in-memory */
  }
  listeners.forEach((l) => l())
}

/** Called from the confirmation screen, with what book_slot returned. */
export function rememberBooking(receipt: BookingReceipt, type: BookingType) {
  if (!receipt.cancel_token) return
  const mine: MyBooking = {
    token: receipt.cancel_token,
    bookingId: receipt.booking_id,
    typeName: receipt.type_name || type.name,
    typeSlug: type.slug,
    kind: receipt.kind ?? type.kind,
    location: receipt.location ?? type.location,
    startsAt: receipt.starts_at,
    endsAt: receipt.ends_at,
    partySize: receipt.party_size ?? 1,
    status: receipt.status,
    savedAt: new Date().toISOString(),
  }
  persist(prune([...items.filter((b) => b.token !== mine.token), mine]))
}

export function forgetBooking(token: string) {
  persist(items.filter((b) => b.token !== token))
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => items

/** The bookings kept on this device (soonest first, past ones dropped). */
export function useMyBookings(): MyBooking[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * The same list, refreshed once from the database so a staff confirmation
 * ("requested" → "confirmed") or a cancellation made elsewhere shows up. Any
 * lookup that fails is left as it was — being offline must not empty the list.
 */
export function useMyBookingsLive(): { bookings: MyBooking[]; checking: boolean } {
  const bookings = useMyBookings()
  const [checking, setChecking] = useState(false)
  const refresh = useCallback(async (list: MyBooking[]) => {
    if (list.length === 0) return
    setChecking(true)
    try {
      const fresh = await Promise.all(
        list.map(async (b) => {
          try {
            const r = await bookingByToken(b.token)
            return r ? { ...b, status: r.status, startsAt: r.starts_at, endsAt: r.ends_at } : b
          } catch {
            return b
          }
        }),
      )
      persist(prune(fresh))
    } finally {
      setChecking(false)
    }
  }, [])

  // Once per mount, for however many bookings this device holds (rarely > 3).
  useEffect(() => {
    void refresh(items)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { bookings, checking }
}
