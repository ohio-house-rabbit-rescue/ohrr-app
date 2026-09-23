// The Midwest BunFest floor plan: numbered tables, who sits at them, and how
// they're drawn.
//
// OHRR sets the layout each year as rows of tables in each room, and types
// table numbers against each vendor or rescue. Tables are numbered 1, 2, 3 …
// through the Burgundy Room, row by row, left to right, then on into the
// Emerald Room — one series, so a volunteer types "7" and never "B7".
//
// Tables side by side in the same row that belong to the same stand are drawn
// as ONE block with the name once ("7–8 · Bubble & Beam"), not the name twice
// in two boxes. Tables in different rows are never merged, even when the
// numbers run on (the end of one row and the start of the next aren't
// neighbours on the floor).
//
// This file is plain TypeScript with no app imports so the website and the
// BunFest site keep identical copies — change it here, copy it there.

export type RoomId = 'burgundy' | 'emerald'

export const ROOM_ORDER: RoomId[] = ['burgundy', 'emerald']
export const ROOM_NAMES: Record<RoomId, string> = {
  burgundy: 'Burgundy Room',
  emerald: 'Emerald Room',
}

/** One row of tables as OHRR sets it up. */
export interface FloorRow {
  room: RoomId
  sort: number
  tables: number
}

/** A row with the table numbers it holds. */
export interface NumberedRow {
  room: RoomId
  /** 0-based within the room, top to bottom. */
  index: number
  first: number
  last: number
  tables: number
}

export type HolderKind = 'vendor' | 'rescue' | 'other'

/** Who sits at a table. `name` is null for someone not published yet. */
export interface TableAssignment {
  table: number
  kind: HolderKind
  id: string | null
  name: string | null
  category: string | null
}

/** One drawn block: a free table, or one stand's run of side-by-side tables. */
export interface Block {
  room: RoomId
  row: number
  /** Position of the first table in the row, 0-based. */
  start: number
  /** How many tables side by side. */
  span: number
  numbers: number[]
  holder: TableAssignment | null
}

/**
 * A starting layout for a year nobody has set up — the same one the database
 * is seeded with. Burgundy 4 rows of 6 (1–24), Emerald 5 rows of 7 (25–59).
 */
export const DEFAULT_ROWS: FloorRow[] = [
  ...[1, 2, 3, 4].map((i) => ({ room: 'burgundy' as RoomId, sort: i * 10, tables: 6 })),
  ...[1, 2, 3, 4, 5].map((i) => ({ room: 'emerald' as RoomId, sort: i * 10, tables: 7 })),
]

/** Give every table its number, Burgundy first, each row left to right. */
export function numberRows(rows: FloorRow[]): NumberedRow[] {
  const out: NumberedRow[] = []
  let next = 1
  for (const room of ROOM_ORDER) {
    const inRoom = rows.filter((r) => r.room === room && r.tables > 0).sort((a, b) => a.sort - b.sort)
    inRoom.forEach((r, index) => {
      out.push({ room, index, first: next, last: next + r.tables - 1, tables: r.tables })
      next += r.tables
    })
  }
  return out
}

export function totalTables(rows: NumberedRow[]): number {
  return rows.length > 0 ? rows[rows.length - 1].last : 0
}

export function roomOfTable(rows: NumberedRow[], table: number): RoomId | null {
  return rows.find((r) => table >= r.first && table <= r.last)?.room ?? null
}

/** Stands merge only with themselves; free tables never merge. */
function holderKey(a: TableAssignment): string {
  return `${a.kind}:${a.id ?? (a.name ?? '').trim().toLowerCase()}`
}

/** The blocks to draw: side-by-side tables of the same stand become one. */
export function buildBlocks(rows: NumberedRow[], assignments: TableAssignment[]): Block[] {
  const at = new Map(assignments.map((a) => [a.table, a]))
  const blocks: Block[] = []
  for (const row of rows) {
    let current: Block | null = null
    for (let pos = 0; pos < row.tables; pos++) {
      const n = row.first + pos
      const holder = at.get(n) ?? null
      if (current && holder && current.holder && holderKey(current.holder) === holderKey(holder)) {
        current.span += 1
        current.numbers.push(n)
        continue
      }
      current = { room: row.room, row: row.index, start: pos, span: 1, numbers: [n], holder }
      blocks.push(current)
    }
  }
  return blocks
}

/** A stand's tables, in order. */
export function tablesOf(assignments: TableAssignment[], kind: HolderKind, id: string): number[] {
  return assignments
    .filter((a) => a.kind === kind && a.id === id)
    .map((a) => a.table)
    .sort((a, b) => a - b)
}

/** [7, 8, 9, 12] → "7–9, 12" */
export function formatNumbers(ns: number[]): string {
  const sorted = [...new Set(ns)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i]
    let to = from
    while (i + 1 < sorted.length && sorted[i + 1] === to + 1) to = sorted[++i]
    parts.push(from === to ? String(from) : `${from}–${to}`)
  }
  return parts.join(', ')
}

/**
 * What a volunteer types, as table numbers: "7", "7, 8", "7-8", "7 – 9, 12",
 * "7 and 8". An empty box means "no tables". Anything else is explained.
 */
export function parseNumbers(text: string): { numbers: number[] } | { error: string } {
  // "7 - 8" → "7-8", so a range survives the split on spaces and commas.
  const cleaned = text
    .replace(/\band\b/gi, ',')
    .replace(/[–—]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .trim()
  if (!cleaned) return { numbers: [] }
  const out = new Set<number>()
  for (const part of cleaned.split(/[\s,;]+/).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      if (b < a) return { error: `“${part}” runs backwards — try ${b}-${a}.` }
      if (b - a > 20) return { error: `“${part}” is more than 20 tables — is that right?` }
      for (let n = a; n <= b; n++) out.add(n)
      continue
    }
    if (/^\d+$/.test(part)) {
      out.add(Number(part))
      continue
    }
    return { error: `“${part}” isn’t a table number. Type numbers like 7, 8 or 7-8.` }
  }
  return { numbers: [...out].sort((a, b) => a - b) }
}

/* -------------------------------------------------------------- drawing */

export const TABLE_GEOMETRY = {
  width: 340,
  pad: 8,
  rowH: 46,
  aisle: 12,
}

/** Where each block sits in a room's drawing, in viewBox units. */
export function layoutRoom(rows: NumberedRow[], blocks: Block[], room: RoomId) {
  const g = TABLE_GEOMETRY
  const roomRows = rows.filter((r) => r.room === room)
  const widest = Math.max(1, ...roomRows.map((r) => r.tables))
  const cellW = (g.width - g.pad * 2) / widest
  const height = g.pad * 2 + roomRows.length * g.rowH + Math.max(0, roomRows.length - 1) * g.aisle
  const placed = blocks
    .filter((b) => b.room === room)
    .map((b) => {
      const row = roomRows[b.row]
      // A shorter row is centred under the widest one.
      const offset = ((widest - row.tables) * cellW) / 2
      return {
        block: b,
        x: g.pad + offset + b.start * cellW + 1.5,
        y: g.pad + b.row * (g.rowH + g.aisle),
        w: b.span * cellW - 3,
        h: g.rowH,
      }
    })
  return { width: g.width, height, placed, cellW }
}

/** Wrap a name into lines that fit a width, with an ellipsis if it runs over. */
export function fitLines(text: string, width: number, fontSize: number, maxLines: number): string[] {
  const perLine = Math.max(3, Math.floor(width / (fontSize * 0.56)))
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let i = 0
  while (i < words.length && lines.length < maxLines) {
    let line = words[i].length > perLine ? words[i].slice(0, perLine) : words[i]
    i++
    while (i < words.length && `${line} ${words[i]}`.length <= perLine) {
      line = `${line} ${words[i]}`
      i++
    }
    lines.push(line)
  }
  // Something didn't fit: say so on the last line rather than cut mid-word.
  if (lines.join(' ').length < words.join(' ').length && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = `${(last.length >= perLine ? last.slice(0, perLine - 1) : last).trimEnd()}…`
  }
  return lines
}
