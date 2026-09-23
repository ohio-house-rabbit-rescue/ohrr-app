// Midwest BunFest content that OHRR edits, with the bundled 2025 data as the
// silent fallback.
//
// The schedule, the vendor list, the rescue directory and the booth map were
// all hard-coded, so publishing this year's programme meant changing code. Each
// now reads its table (supabase/migrations/20260922120000_bunfest_content.sql);
// until staff type the new year in, the app keeps showing last year's with the
// same "2025 — this year's is announced closer to the event" note it always
// had. `source` tells a page which it is looking at.
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useBunfestEvent } from '../../lib/events'
import type { Database } from '../../lib/database.types'
import { sessions as seedSessions, type Session } from '../../data/sessions'
import { partners as seedPartners, type Partner } from '../../data/partners'
import { vendors as seedVendors, type Vendor } from '../../data/vendors'
import { allPlacedBooths, booths as seedBooths, type BoothAssignment, type RoomId } from '../../data/floorplan'

export type Source = 'live' | 'seed'
export interface Live<T> {
  items: T[]
  source: Source
  loading: boolean
}

type SessionRow = Database['public']['Tables']['bunfest_sessions']['Row']
type PartnerRow = Database['public']['Tables']['rescue_partners']['Row']

/** "13:30:00" → "1:30 PM" */
function clock(t: string): string {
  const [h, m] = t.split(':').map(Number)
  if (!Number.isFinite(h)) return t
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m || 0).padStart(2, '0')} ${suffix}`
}

/** "1:30 – 2:00 PM" (the AM/PM is dropped from the start when both match). */
export function timeRange(start: string, end: string | null): string {
  const a = clock(start)
  if (!end) return a
  const b = clock(end)
  const sameHalf = a.slice(-2) === b.slice(-2)
  return `${sameHalf ? a.slice(0, -3) : a} – ${b}`
}

function rowToSession(r: SessionRow): Session {
  return {
    id: r.id,
    start: r.start_time.slice(0, 5),
    time: timeRange(r.start_time, r.end_time),
    title: r.title,
    presenter: [r.presenter, r.room].filter(Boolean).join(' · '),
    description: r.description ?? '',
    track: r.track || undefined,
    isBreak: r.kind === 'break',
  }
}

function rowToPartner(r: PartnerRow, year: number): Partner {
  return {
    id: r.id,
    name: r.name,
    location: r.location ?? [r.city, r.state].filter(Boolean).join(', '),
    city: r.city ?? undefined,
    state: r.state ?? undefined,
    region: r.region ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    address: r.address ?? undefined,
    url: r.website ?? undefined,
    host: r.is_host,
    // A rescue nobody has tagged by year yet falls back to the older flag.
    atBunfest: r.bunfest_years.length > 0 ? r.bunfest_years.includes(year) : r.at_bunfest,
  }
}

/** The education programme — the newest year that has published sessions. */
export function useBunfestSessions(): Live<Session> {
  const [state, setState] = useState<Live<Session>>({ items: seedSessions, source: 'seed', loading: isSupabaseConfigured })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('bunfest_sessions')
      .select('*')
      .eq('is_published', true)
      .order('year', { ascending: false })
      .order('start_time', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data || data.length === 0) {
          setState({ items: seedSessions, source: 'seed', loading: false })
          return
        }
        const year = data[0].year
        const rows = data.filter((r) => r.year === year).sort((a, b) => a.start_time.localeCompare(b.start_time))
        setState({ items: rows.map(rowToSession), source: 'live', loading: false })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

/** The rescue directory. `bunfestOnly` keeps it to this year's BunFest partners. */
export function useRescuePartners(bunfestOnly = false): Live<Partner> {
  const bunfest = useBunfestEvent()
  const year = new Date(bunfest.startsAt).getFullYear()
  const [state, setState] = useState<Live<Partner>>({ items: seedPartners, source: 'seed', loading: isSupabaseConfigured })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase
      .from('rescue_partners')
      .select('*')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data || data.length === 0) {
          setState({ items: seedPartners, source: 'seed', loading: false })
          return
        }
        // `bunfest_years` holds the years a rescue came. A row nobody has
        // tagged by year yet falls back to the older at_bunfest flag, so the
        // list doesn't empty out between the migration and the first edit.
        const rows = bunfestOnly
          ? data.filter((r) =>
              r.bunfest_years.length > 0 ? r.bunfest_years.includes(year) : r.at_bunfest,
            )
          : data
        if (rows.length === 0) {
          setState({ items: seedPartners, source: 'seed', loading: false })
          return
        }
        setState({ items: rows.map((r) => rowToPartner(r, year)), source: 'live', loading: false })
      })
    return () => {
      active = false
    }
  }, [bunfestOnly, year])
  return state
}

/** A vendor as the public pages show one, plus where their table is. */
export interface BunfestVendor extends Vendor {
  booth?: string
  room?: RoomId
  tables: 1 | 2
}

export interface VendorsResult {
  items: BunfestVendor[]
  /** Room assignments in display order, for the floor plan. */
  assignments: BoothAssignment[]
  source: Source
  loading: boolean
}

// The bundled vendors carry the estimated booth labels ("B7") the floor plan
// computes, so the list and the map agree before OHRR enters real ones.
const seedLabels = new Map(allPlacedBooths.map((b) => [b.vendorId, b.label]))

const seedResult: VendorsResult = {
  items: seedVendors.map((v) => {
    const booth = seedBooths.find((b) => b.vendorId === v.id)
    return { ...v, booth: seedLabels.get(v.id), room: booth?.room, tables: booth?.tables ?? 1 }
  }),
  assignments: seedBooths,
  source: 'seed',
  loading: false,
}

export function useBunfestVendors(): VendorsResult {
  const bunfest = useBunfestEvent()
  const year = new Date(bunfest.startsAt).getFullYear()
  const [state, setState] = useState<VendorsResult>({ ...seedResult, loading: isSupabaseConfigured })
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase.rpc('bunfest_vendors_public', { p_year: year }).then(({ data, error }) => {
      if (!active) return
      const rows = Array.isArray(data) ? data : []
      if (error || rows.length === 0) {
        setState({ ...seedResult, loading: false })
        return
      }
      const items: BunfestVendor[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category ?? 'Vendors',
        description: r.blurb ?? '',
        url: r.website ?? undefined,
        booth: r.booth ?? undefined,
        room: r.room ?? undefined,
        tables: (r.tables === 2 ? 2 : 1) as 1 | 2,
      }))
      // Only vendors OHRR has put in a room appear on the map; the rest still
      // appear in the list.
      const assignments: BoothAssignment[] = items
        .filter((v): v is BunfestVendor & { room: RoomId } => Boolean(v.room))
        .map((v) => ({ vendorId: v.id, room: v.room, tables: v.tables }))
      setState({ items, assignments, source: 'live', loading: false })
    })
    return () => {
      active = false
    }
  }, [year])
  return state
}

/** Categories present in a vendor list, for the filter row. */
export function vendorCategoriesOf(items: BunfestVendor[]): string[] {
  return [...new Set(items.map((v) => v.category).filter(Boolean))].sort()
}
