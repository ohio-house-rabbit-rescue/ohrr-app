// This year's BunFest floor from the database: the venue OHRR designed and who
// sits at each table. Until a venue is saved for 2026 the map draws the
// bundled starting design; for any other year with no venue it says the plan
// isn't out yet rather than showing last year's building.
import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useBunfestEvent } from '../../lib/events'
import {
  MAKOY_2026,
  buildBlocks,
  parseVenue,
  placeTables,
  roomOfTable,
  tablesOf,
  type Block,
  type HolderKind,
  type PlacedTable,
  type TableAssignment,
  type Venue,
} from './floor'

export interface FloorState {
  year: number
  /** Null when there is no plan for this year yet. */
  venue: Venue | null
  tables: PlacedTable[]
  assignments: TableAssignment[]
  blocks: Block[]
  /** True once OHRR has saved a venue for this year. */
  saved: boolean
  loading: boolean
  /** A stand's tables and the room they're in. */
  placeOf: (kind: HolderKind, id: string) => { numbers: number[]; roomName: string | null }
}

/** The bundled start, only for the year it describes. */
export function fallbackVenue(year: number): Venue | null {
  return year === 2026 ? MAKOY_2026 : null
}

export function useBunfestFloor(): FloorState {
  const bunfest = useBunfestEvent()
  const year = new Date(bunfest.startsAt).getFullYear()
  const [raw, setRaw] = useState<{ venue: Venue | null; assignments: TableAssignment[]; saved: boolean; loading: boolean }>({
    venue: fallbackVenue(year),
    assignments: [],
    saved: false,
    loading: isSupabaseConfigured,
  })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    Promise.all([
      supabase.from('bunfest_venues').select('layout').eq('year', year).maybeSingle(),
      supabase.rpc('bunfest_tables_public', { p_year: year }),
    ]).then(([venueRes, tablesRes]) => {
      if (!active) return
      const saved = venueRes.data ? parseVenue(venueRes.data.layout) : null
      const assignments: TableAssignment[] = (Array.isArray(tablesRes.data) ? tablesRes.data : []).map((t) => ({
        table: t.table_no,
        kind: t.kind,
        id: t.ref_id,
        name: t.name,
        category: t.category,
      }))
      setRaw({ venue: saved ?? fallbackVenue(year), assignments, saved: !!saved, loading: false })
    })
    return () => {
      active = false
    }
  }, [year])

  return useMemo(() => {
    const tables = raw.venue ? placeTables(raw.venue) : []
    return {
      year,
      venue: raw.venue,
      tables,
      assignments: raw.assignments,
      blocks: buildBlocks(tables, raw.assignments),
      saved: raw.saved,
      loading: raw.loading,
      placeOf: (kind, id) => {
        const numbers = tablesOf(raw.assignments, kind, id)
        const roomId = numbers.length > 0 ? roomOfTable(tables, numbers[0]) : null
        return { numbers, roomName: raw.venue?.rooms.find((r) => r.id === roomId)?.name ?? null }
      },
    }
  }, [raw, year])
}
