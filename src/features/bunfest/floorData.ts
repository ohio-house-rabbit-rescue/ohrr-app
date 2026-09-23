// This year's BunFest floor from the database: the table layout OHRR set up
// and who sits at each table. Until a layout exists the map draws the default
// one, and until tables are assigned it says so rather than inventing places.
import { useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { useBunfestEvent } from '../../lib/events'
import {
  DEFAULT_ROWS,
  buildBlocks,
  numberRows,
  roomOfTable,
  tablesOf,
  type Block,
  type FloorRow,
  type HolderKind,
  type NumberedRow,
  type RoomId,
  type TableAssignment,
} from './floor'

export interface FloorState {
  year: number
  rows: NumberedRow[]
  assignments: TableAssignment[]
  blocks: Block[]
  /** False until OHRR has set this year's rows up. */
  hasLayout: boolean
  loading: boolean
  /** A stand's tables and the room they're in. */
  placeOf: (kind: HolderKind, id: string) => { numbers: number[]; room: RoomId | null }
}

export function useBunfestFloor(): FloorState {
  const bunfest = useBunfestEvent()
  const year = new Date(bunfest.startsAt).getFullYear()
  const [raw, setRaw] = useState<{ rows: FloorRow[]; assignments: TableAssignment[]; hasLayout: boolean; loading: boolean }>({
    rows: DEFAULT_ROWS,
    assignments: [],
    hasLayout: false,
    loading: isSupabaseConfigured,
  })

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    Promise.all([
      supabase.from('bunfest_floor_rows').select('room, sort_order, tables').eq('year', year),
      supabase.rpc('bunfest_tables_public', { p_year: year }),
    ]).then(([rowsRes, tablesRes]) => {
      if (!active) return
      const rows = (rowsRes.data ?? []).map((r) => ({ room: r.room, sort: r.sort_order, tables: r.tables }))
      const assignments: TableAssignment[] = (Array.isArray(tablesRes.data) ? tablesRes.data : []).map((t) => ({
        table: t.table_no,
        kind: t.kind,
        id: t.ref_id,
        name: t.name,
        category: t.category,
      }))
      setRaw({
        rows: rows.length > 0 ? rows : DEFAULT_ROWS,
        assignments,
        hasLayout: rows.length > 0,
        loading: false,
      })
    })
    return () => {
      active = false
    }
  }, [year])

  return useMemo(() => {
    const rows = numberRows(raw.rows)
    return {
      year,
      rows,
      assignments: raw.assignments,
      blocks: buildBlocks(rows, raw.assignments),
      hasLayout: raw.hasLayout,
      loading: raw.loading,
      placeOf: (kind, id) => {
        const numbers = tablesOf(raw.assignments, kind, id)
        return { numbers, room: numbers.length > 0 ? roomOfTable(rows, numbers[0]) : null }
      },
    }
  }, [raw, year])
}
