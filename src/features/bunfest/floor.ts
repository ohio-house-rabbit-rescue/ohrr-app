// The Midwest BunFest floor plan: the venue OHRR designs each year, its
// numbered tables, who sits at them, and how they're drawn.
//
// The venue is data, not code, because it changes: 2026 is two rooms at The
// Makoy, next year may be somewhere else entirely with no idea yet of the shape
// or how many rooms. So a year's venue is a list of rooms, each a size in feet,
// holding:
//
//   runs   rows of tables — where the row starts, which way it runs, how many
//          tables, the table size, which side customers stand on, and a
//          walkway after every so many tables
//   areas  the stage, the spa, restrooms, the Hop Shop — or "blocked", to cut
//          a corner out of a room that isn't a plain rectangle
//   doors  a gap in a wall, with a label
//
// Tables are numbered 1, 2, 3 … room by room, row by row, along each row, so a
// volunteer types "7" and never "B7". Side-by-side tables of one stand are
// drawn as ONE block with the name once; a walkway or a different row breaks
// that, because those tables aren't neighbours on the floor.
//
// Positions are in feet from the room's left wall (x) and top wall (y) as
// drawn. This file is plain TypeScript with no app imports, so the website and
// the BunFest site keep identical copies — change it here, copy it there.

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type AreaKind = 'stage' | 'service' | 'amenity' | 'restroom' | 'shop' | 'seating' | 'blocked'

export interface TableRun {
  id: string
  /** Feet from the left wall to the first table's corner. */
  x: number
  /** Feet from the top wall. */
  y: number
  /** true: runs left to right; false: runs top to bottom. */
  across: boolean
  tables: number
  /** Table size in feet — 8 × 2.5 is the usual banquet table. */
  length: number
  depth: number
  /** A walkway after every this-many tables (0 = none). */
  walkEvery: number
  walkWidth: number
  /** The side customers stand on. */
  front: Side
}

export interface Area {
  id: string
  label: string
  kind: AreaKind
  x: number
  y: number
  w: number
  h: number
}

export interface Door {
  id: string
  label: string
  wall: Side
  /** Feet along the wall from its left (top/bottom walls) or top (side walls) end. */
  at: number
  width: number
}

export interface Room {
  id: string
  name: string
  width: number
  depth: number
  note: string
  runs: TableRun[]
  areas: Area[]
  doors: Door[]
}

export interface Venue {
  version: 1
  name: string
  rooms: Room[]
}

export const AREA_KINDS: { value: AreaKind; label: string }[] = [
  { value: 'stage', label: 'Stage' },
  { value: 'service', label: 'Activity (spa, photos, lounge)' },
  { value: 'shop', label: 'Shop or sponsor' },
  { value: 'amenity', label: 'Other (auction, info, stairs)' },
  { value: 'seating', label: 'Seating' },
  { value: 'restroom', label: 'Restrooms' },
  { value: 'blocked', label: 'Not part of the room' },
]

/* ------------------------------------------------------- the 2026 start */

/**
 * The Makoy, 2026 — the Burgundy and Emerald Rooms converted from the
 * published map. The map isn't to scale, so the room sizes (96 × 64 ft) are
 * an estimate; the rows are realistic (8 × 2.5 ft tables, 6 ft aisles, rows
 * back to back) and sized to this year's roster. The database is seeded with
 * the same layout.
 */
export const MAKOY_2026: Venue = {
  version: 1,
  name: 'The Makoy',
  rooms: [
    {
      id: 'burgundy',
      name: 'Burgundy Room',
      width: 96,
      depth: 64,
      note: '',
      runs: [
        { id: 'br1', x: 59, y: 15, across: true, tables: 4, length: 8, depth: 2.5, walkEvery: 0, walkWidth: 6, front: 'bottom' },
        { id: 'br2', x: 59, y: 23.5, across: true, tables: 4, length: 8, depth: 2.5, walkEvery: 0, walkWidth: 6, front: 'top' },
        { id: 'br3', x: 59, y: 26, across: true, tables: 4, length: 8, depth: 2.5, walkEvery: 0, walkWidth: 6, front: 'bottom' },
        { id: 'br4', x: 59, y: 34.5, across: true, tables: 4, length: 8, depth: 2.5, walkEvery: 0, walkWidth: 6, front: 'top' },
        { id: 'br5', x: 59, y: 37, across: true, tables: 4, length: 8, depth: 2.5, walkEvery: 0, walkWidth: 6, front: 'bottom' },
        { id: 'br6', x: 59, y: 45.5, across: true, tables: 4, length: 8, depth: 2.5, walkEvery: 0, walkWidth: 6, front: 'top' },
      ],
      areas: [
        { id: 'ba1', label: 'Chillaxabun Lounge', kind: 'service', x: 2.5, y: 2.5, w: 21.5, h: 13.5 },
        { id: 'ba2', label: 'Women’s Room', kind: 'restroom', x: 2.5, y: 40.5, w: 21.5, h: 9.5 },
        { id: 'ba3', label: 'Men’s Room', kind: 'restroom', x: 2.5, y: 52.0, w: 21.5, h: 9.5 },
        { id: 'ba4', label: 'Glamour Shots', kind: 'service', x: 26.0, y: 2.5, w: 28.5, h: 11.0 },
        { id: 'ba5', label: 'Bunny Spa', kind: 'service', x: 26.0, y: 15.0, w: 28.5, h: 11.0 },
        { id: 'ba6', label: 'Sitting Area', kind: 'seating', x: 26.0, y: 28.0, w: 28.5, h: 16.5 },
        { id: 'ba7', label: 'Special Interest Sessions', kind: 'amenity', x: 26.0, y: 52.0, w: 46.0, h: 9.5 },
        { id: 'ba8', label: 'Stage', kind: 'stage', x: 56.0, y: 2.5, w: 18.0, h: 10.5 },
        { id: 'ba9', label: 'Bunny Painting', kind: 'service', x: 75.5, y: 2.5, w: 18.5, h: 10.5 },
      ],
      doors: [
        { id: 'bd1', label: 'Entrance', wall: 'left', at: 29, width: 6 },
      ],
    },
    {
      id: 'emerald',
      name: 'Emerald Room',
      width: 96,
      depth: 64,
      note: 'Stairs up to the education sessions',
      runs: [
        { id: 'er1', x: 4, y: 17, across: true, tables: 7, length: 8, depth: 2.5, walkEvery: 4, walkWidth: 6, front: 'bottom' },
        { id: 'er2', x: 4, y: 25.5, across: true, tables: 7, length: 8, depth: 2.5, walkEvery: 4, walkWidth: 6, front: 'top' },
        { id: 'er3', x: 4, y: 28, across: true, tables: 7, length: 8, depth: 2.5, walkEvery: 4, walkWidth: 6, front: 'bottom' },
        { id: 'er4', x: 4, y: 36.5, across: true, tables: 7, length: 8, depth: 2.5, walkEvery: 4, walkWidth: 6, front: 'top' },
        { id: 'er5', x: 4, y: 39, across: true, tables: 7, length: 8, depth: 2.5, walkEvery: 4, walkWidth: 6, front: 'bottom' },
      ],
      areas: [
        { id: 'ea1', label: 'Food & Drink Sales', kind: 'service', x: 2.5, y: 2.5, w: 29.5, h: 11.5 },
        { id: 'ea2', label: 'OHRR Table', kind: 'amenity', x: 34.0, y: 2.5, w: 21.5, h: 11.5 },
        { id: 'ea3', label: 'Stairs to Education', kind: 'amenity', x: 72.5, y: 2.5, w: 21.5, h: 13.0 },
        { id: 'ea4', label: 'OHRR Hop Shop', kind: 'shop', x: 72.5, y: 17.5, w: 21.5, h: 13.0 },
        { id: 'ea5', label: 'Oxbow', kind: 'shop', x: 72.5, y: 31.5, w: 21.5, h: 10.5 },
        { id: 'ea6', label: 'Men’s', kind: 'restroom', x: 72.5, y: 43.5, w: 10.5, h: 11.5 },
        { id: 'ea7', label: 'Women’s', kind: 'restroom', x: 83.5, y: 43.5, w: 10.5, h: 11.5 },
        { id: 'ea8', label: 'Silent Auction', kind: 'amenity', x: 25.0, y: 48.5, w: 46.0, h: 6.5 },
        { id: 'ea9', label: 'Raffle', kind: 'amenity', x: 2.5, y: 55.5, w: 21.0, h: 7.5 },
        { id: 'ea10', label: 'Stage', kind: 'stage', x: 24.5, y: 55.5, w: 26.5, h: 7.5 },
        { id: 'ea11', label: 'MedVet', kind: 'service', x: 52.5, y: 55.5, w: 18.0, h: 7.5 },
      ],
      doors: [
        { id: 'ed1', label: 'Entrance', wall: 'right', at: 29, width: 6 },
      ],
    },
  ],
}

export function blankVenue(name = ''): Venue {
  return { version: 1, name, rooms: [newRoom('Main room')] }
}

let counter = 0
/** A short id that is unique within a venue. */
export function newId(prefix: string): string {
  counter = (counter + 1) % 1000
  return `${prefix}${Date.now().toString(36).slice(-5)}${counter}`
}

export function newRoom(name: string): Room {
  return { id: newId('room'), name, width: 80, depth: 50, note: '', runs: [], areas: [], doors: [] }
}

export function newRun(room: Room): TableRun {
  // Below the lowest row so far, or near the top of an empty room.
  const lowest = room.runs.reduce((y, r) => Math.max(y, r.y + (r.across ? r.depth : runSpan(r))), 4)
  return {
    id: newId('run'),
    x: 6,
    y: Math.min(room.depth - 3, room.runs.length ? lowest + 6 : 10),
    across: true,
    tables: 4,
    length: 8,
    depth: 2.5,
    walkEvery: 0,
    walkWidth: 6,
    front: 'bottom',
  }
}

/**
 * A copy of a row placed where the next row usually goes: facing it across a
 * 6 ft aisle if it faces the new row's way, otherwise back to back.
 */
export function duplicateRun(r: TableRun): TableRun {
  const facingNext = r.across ? r.front === 'bottom' : r.front === 'right'
  const step = r.depth + (facingNext ? 6 : 0)
  return {
    ...r,
    id: newId('run'),
    x: r.across ? r.x : r.x + step,
    y: r.across ? r.y + step : r.y,
    front: facingNext ? (r.across ? 'top' : 'left') : r.across ? 'bottom' : 'right',
  }
}

/* --------------------------------------------------------- geometry */

/** How far a row reaches along its length, walkways included. */
export function runSpan(r: TableRun): number {
  const breaks = r.walkEvery > 0 ? Math.floor((r.tables - 1) / r.walkEvery) : 0
  return r.tables * r.length + breaks * r.walkWidth
}

/** A run's outline in feet. */
export function runBox(r: TableRun) {
  const span = runSpan(r)
  return r.across ? { x: r.x, y: r.y, w: span, h: r.depth } : { x: r.x, y: r.y, w: r.depth, h: span }
}

export interface PlacedTable {
  no: number
  roomId: string
  runId: string
  /** Which walkway-separated stretch of the row. */
  segment: number
  pos: number
  x: number
  y: number
  w: number
  h: number
  across: boolean
  front: Side
}

/** Every table with its number and where it sits. */
export function placeTables(venue: Venue): PlacedTable[] {
  const out: PlacedTable[] = []
  let no = 1
  for (const room of venue.rooms) {
    for (const r of room.runs) {
      for (let i = 0; i < r.tables; i++) {
        const segment = r.walkEvery > 0 ? Math.floor(i / r.walkEvery) : 0
        const along = i * r.length + segment * r.walkWidth
        out.push({
          no: no++,
          roomId: room.id,
          runId: r.id,
          segment,
          pos: i,
          x: r.across ? r.x + along : r.x,
          y: r.across ? r.y : r.y + along,
          w: r.across ? r.length : r.depth,
          h: r.across ? r.depth : r.length,
          across: r.across,
          front: r.front,
        })
      }
    }
  }
  return out
}

export function totalTables(venue: Venue): number {
  return venue.rooms.reduce((n, room) => n + room.runs.reduce((m, r) => m + Math.max(0, r.tables), 0), 0)
}

/** The first and last table number in each room. */
export function roomRanges(venue: Venue): Map<string, [number, number] | null> {
  const m = new Map<string, [number, number] | null>()
  let next = 1
  for (const room of venue.rooms) {
    const n = room.runs.reduce((s, r) => s + Math.max(0, r.tables), 0)
    m.set(room.id, n > 0 ? [next, next + n - 1] : null)
    next += n
  }
  return m
}

/** The first and last table number of each row. */
export function runRanges(venue: Venue): Map<string, [number, number]> {
  const m = new Map<string, [number, number]>()
  let next = 1
  for (const room of venue.rooms)
    for (const r of room.runs) {
      m.set(r.id, [next, next + r.tables - 1])
      next += r.tables
    }
  return m
}

/* ------------------------------------------------ who sits where */

export type HolderKind = 'vendor' | 'rescue' | 'other'

/** Who sits at a table. `name` is null for someone not published yet. */
export interface TableAssignment {
  table: number
  kind: HolderKind
  id: string | null
  name: string | null
  category: string | null
}

/** One drawn block: a free table, or one stand's side-by-side tables. */
export interface Block {
  roomId: string
  runId: string
  numbers: number[]
  holder: TableAssignment | null
  x: number
  y: number
  w: number
  h: number
  across: boolean
  front: Side
}

/** Stands merge only with themselves; free tables never merge. */
function holderKey(a: TableAssignment): string {
  return `${a.kind}:${a.id ?? (a.name ?? '').trim().toLowerCase()}`
}

export function buildBlocks(tables: PlacedTable[], assignments: TableAssignment[]): Block[] {
  const at = new Map(assignments.map((a) => [a.table, a]))
  const blocks: Block[] = []
  let prev: { t: PlacedTable; b: Block } | null = null
  for (const t of tables) {
    const holder = at.get(t.no) ?? null
    const joins =
      prev &&
      holder &&
      prev.b.holder &&
      prev.t.runId === t.runId &&
      prev.t.segment === t.segment &&
      prev.t.pos + 1 === t.pos &&
      holderKey(prev.b.holder) === holderKey(holder)
    if (joins && prev) {
      const b: Block = prev.b
      const x2 = Math.max(b.x + b.w, t.x + t.w)
      const y2 = Math.max(b.y + b.h, t.y + t.h)
      b.x = Math.min(b.x, t.x)
      b.y = Math.min(b.y, t.y)
      b.w = x2 - b.x
      b.h = y2 - b.y
      b.numbers.push(t.no)
      prev = { t, b }
      continue
    }
    const b: Block = {
      roomId: t.roomId,
      runId: t.runId,
      numbers: [t.no],
      holder,
      x: t.x,
      y: t.y,
      w: t.w,
      h: t.h,
      across: t.across,
      front: t.front,
    }
    blocks.push(b)
    prev = { t, b }
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

export function roomOfTable(tables: PlacedTable[], no: number): string | null {
  return tables.find((t) => t.no === no)?.roomId ?? null
}

/* ------------------------------------------------ checking a design */

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01
}

/**
 * Problems with a design, in words. `errors` stop a save (a room with no
 * size, a row of 0 tables); `warnings` are things that look wrong but might be
 * meant (a row poking through a wall, two things on top of each other).
 */
export function checkVenue(venue: Venue): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  if (venue.rooms.length === 0) errors.push('Add at least one room.')
  const ranges = runRanges(venue)
  for (const room of venue.rooms) {
    const name = room.name.trim() || 'A room'
    if (!room.name.trim()) errors.push('Every room needs a name.')
    if (!(room.width >= 5 && room.depth >= 5)) errors.push(`${name}: give it a size of at least 5 × 5 ft.`)
    const inside = (b: { x: number; y: number; w: number; h: number }) =>
      b.x >= -0.01 && b.y >= -0.01 && b.x + b.w <= room.width + 0.01 && b.y + b.h <= room.depth + 0.01
    room.runs.forEach((r) => {
      const [a, z] = ranges.get(r.id) ?? [0, 0]
      const label = `${name}, tables ${a}–${z}`
      if (!(r.tables >= 1 && r.tables <= 40)) errors.push(`${name}: a row holds between 1 and 40 tables.`)
      if (!(r.length > 0 && r.depth > 0)) errors.push(`${label}: the tables need a size.`)
      if (!inside(runBox(r))) warnings.push(`${label} runs past a wall.`)
    })
    room.areas.forEach((ar) => {
      if (!inside(ar)) warnings.push(`${name}: “${ar.label || 'an area'}” runs past a wall.`)
    })
    // Tables on top of each other, or on the stage.
    for (let i = 0; i < room.runs.length; i++) {
      const bi = runBox(room.runs[i])
      for (let j = i + 1; j < room.runs.length; j++)
        if (overlaps(bi, runBox(room.runs[j]))) {
          const [a1] = ranges.get(room.runs[i].id) ?? [0]
          const [a2] = ranges.get(room.runs[j].id) ?? [0]
          warnings.push(`${name}: the rows starting at table ${a1} and table ${a2} overlap.`)
        }
      for (const ar of room.areas)
        if (ar.kind !== 'seating' && overlaps(bi, ar)) {
          const [a1] = ranges.get(room.runs[i].id) ?? [0]
          warnings.push(`${name}: the row starting at table ${a1} sits on “${ar.label}”.`)
        }
    }
    room.doors.forEach((d) => {
      const len = d.wall === 'top' || d.wall === 'bottom' ? room.width : room.depth
      if (d.at < 0 || d.at + d.width > len + 0.01) warnings.push(`${name}: “${d.label || 'a door'}” is off the end of its wall.`)
    })
  }
  return { errors, warnings }
}

/** A venue read back from the database, trusted only as far as its shape. */
export function parseVenue(v: unknown): Venue | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (!Array.isArray(o.rooms)) return null
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d)
  const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d)
  const side = (x: unknown, d: Side): Side => (x === 'top' || x === 'bottom' || x === 'left' || x === 'right' ? x : d)
  const kinds = new Set(AREA_KINDS.map((k) => k.value))
  const arr = (x: unknown) => (Array.isArray(x) ? (x.filter((i) => i && typeof i === 'object') as Record<string, unknown>[]) : [])
  return {
    version: 1,
    name: str(o.name),
    rooms: arr(o.rooms).map((r, ri) => ({
      id: str(r.id, `room${ri}`),
      name: str(r.name, `Room ${ri + 1}`),
      width: num(r.width, 80),
      depth: num(r.depth, 50),
      note: str(r.note),
      runs: arr(r.runs).map((x, i) => ({
        id: str(x.id, `run${ri}-${i}`),
        x: num(x.x, 0),
        y: num(x.y, 0),
        across: x.across !== false,
        tables: Math.round(num(x.tables, 1)),
        length: num(x.length, 8),
        depth: num(x.depth, 2.5),
        walkEvery: Math.max(0, Math.round(num(x.walkEvery, 0))),
        walkWidth: num(x.walkWidth, 6),
        front: side(x.front, 'bottom'),
      })),
      areas: arr(r.areas).map((x, i) => ({
        id: str(x.id, `area${ri}-${i}`),
        label: str(x.label),
        kind: (kinds.has(x.kind as AreaKind) ? x.kind : 'amenity') as AreaKind,
        x: num(x.x, 0),
        y: num(x.y, 0),
        w: num(x.w, 10),
        h: num(x.h, 10),
      })),
      doors: arr(r.doors).map((x, i) => ({
        id: str(x.id, `door${ri}-${i}`),
        label: str(x.label, 'Door'),
        wall: side(x.wall, 'bottom'),
        at: num(x.at, 0),
        width: num(x.width, 6),
      })),
    })),
  }
}

/* ------------------------------------------------ what people type */

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
    const range = part.match(/^(\d+)-(\d+)$/)
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

/** Wrap a name into lines that fit a width, with an ellipsis if it runs over. */
export function fitLines(text: string, width: number, fontSize: number, maxLines: number): string[] {
  const perLine = Math.floor(width / (fontSize * 0.56))
  if (perLine < 3) return []
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
