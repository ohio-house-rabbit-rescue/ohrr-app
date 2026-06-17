// In-app Midwest BunFest floor plan, modeled on the real 2025 "Booth Set-Up &
// Event Map" (midwestbunfest.org/event-map.html): two rooms — the Burgundy Room
// and the Emerald Room — each with its own stage, amenities, and a big
// "Sponsors, Rescue Partners, Vendors" block. Education sessions are upstairs.
//
// The fixed amenities/zones mirror the published map. The per-vendor BOOTH
// numbers and table counts are an ESTIMATE: OHRR doesn't publish vendor
// positions, so we lay the 2025 vendors into the vendor blocks (Burgundy runs
// left→right, Emerald runs top→bottom) and give each one or two 8-ft tables, to
// show how the space comes together. Final assignments come from OHRR.
import type { IconName } from '../components/icons'
import { vendors, vendorCategories } from './vendors'

export type RoomId = 'burgundy' | 'emerald'

export interface VendorGrid {
  x: number
  y: number
  w: number
  h: number
  cols: number
  rows: number
  order: 'row' | 'col' // 'row' = left→right, 'col' = top→bottom
}

export interface FloorRoom {
  id: RoomId
  name: string
  viewW: number
  viewH: number
  grid: VendorGrid
}

export const rooms: FloorRoom[] = [
  {
    id: 'burgundy',
    name: 'Burgundy Room',
    viewW: 340,
    viewH: 240,
    grid: { x: 196, y: 60, w: 124, h: 120, cols: 3, rows: 4, order: 'row' },
  },
  {
    id: 'emerald',
    name: 'Emerald Room',
    viewW: 340,
    viewH: 240,
    grid: { x: 22, y: 66, w: 220, h: 104, cols: 4, rows: 4, order: 'col' },
  },
]

export type ZoneKind =
  | 'stage'
  | 'amenity'
  | 'restroom'
  | 'sitting'
  | 'shop'
  | 'service'
  | 'entrance'

export interface FloorZone {
  room: RoomId
  label: string
  x: number
  y: number
  w: number
  h: number
  kind: ZoneKind
}

// Fixed areas, positioned to echo the published 2025 map.
export const zones: FloorZone[] = [
  // ---- Burgundy Room ----
  { room: 'burgundy', label: 'Chillaxabun Lounge', x: 22, y: 18, w: 70, h: 46, kind: 'service' },
  { room: 'burgundy', label: 'Women’s Room', x: 22, y: 150, w: 70, h: 32, kind: 'restroom' },
  { room: 'burgundy', label: 'Men’s Room', x: 22, y: 188, w: 70, h: 32, kind: 'restroom' },
  { room: 'burgundy', label: 'Glamour Shots', x: 98, y: 18, w: 92, h: 38, kind: 'service' },
  { room: 'burgundy', label: 'Bunny Spa', x: 98, y: 62, w: 92, h: 38, kind: 'service' },
  { room: 'burgundy', label: 'Sitting Area', x: 98, y: 106, w: 92, h: 56, kind: 'sitting' },
  { room: 'burgundy', label: 'Special Interest Sessions', x: 98, y: 188, w: 150, h: 32, kind: 'amenity' },
  { room: 'burgundy', label: 'Stage', x: 196, y: 18, w: 58, h: 36, kind: 'stage' },
  { room: 'burgundy', label: 'Bunny Painting', x: 260, y: 18, w: 60, h: 36, kind: 'service' },

  // ---- Emerald Room ----
  { room: 'emerald', label: 'Food & Drink Sales', x: 22, y: 18, w: 96, h: 40, kind: 'service' },
  { room: 'emerald', label: 'OHRR Table', x: 124, y: 18, w: 70, h: 40, kind: 'amenity' },
  { room: 'emerald', label: 'Stairs to Education', x: 250, y: 18, w: 70, h: 44, kind: 'amenity' },
  { room: 'emerald', label: 'OHRR Hop Shop', x: 250, y: 70, w: 70, h: 44, kind: 'shop' },
  { room: 'emerald', label: 'Oxbow', x: 250, y: 118, w: 70, h: 36, kind: 'shop' },
  { room: 'emerald', label: 'Men’s', x: 250, y: 160, w: 34, h: 40, kind: 'restroom' },
  { room: 'emerald', label: 'Women’s', x: 286, y: 160, w: 34, h: 40, kind: 'restroom' },
  { room: 'emerald', label: 'Silent Auction', x: 96, y: 176, w: 150, h: 22, kind: 'amenity' },
  { room: 'emerald', label: 'Raffle', x: 22, y: 201, w: 68, h: 25, kind: 'amenity' },
  { room: 'emerald', label: 'Stage', x: 94, y: 201, w: 86, h: 25, kind: 'stage' },
  { room: 'emerald', label: 'MedVet', x: 184, y: 201, w: 58, h: 25, kind: 'service' },
]

// Entrances (drawn as a gap + outside label).
export const entrances: { room: RoomId; side: 'left' | 'right'; y: number }[] = [
  { room: 'burgundy', side: 'left', y: 120 },
  { room: 'emerald', side: 'right', y: 120 },
]

export interface BoothAssignment {
  vendorId: string
  room: RoomId
  tables: 1 | 2
}

// Which vendors sit in which room, in placement order. Booth number is the
// 1-based position within the room (prefixed B/E). A handful of larger-footprint
// vendors (beds, food, treats) get two 8-ft tables.
const TWO_TABLE = new Set(['v3', 'v6', 'v8', 'v22', 'v25', 'v26'])
const BURGUNDY_IDS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10', 'v11', 'v12']
const EMERALD_IDS = ['v13', 'v14', 'v15', 'v16', 'v17', 'v18', 'v19', 'v20', 'v21', 'v22', 'v23', 'v24', 'v25', 'v26', 'v27']

export const booths: BoothAssignment[] = [
  ...BURGUNDY_IDS.map((vendorId) => ({ vendorId, room: 'burgundy' as RoomId, tables: (TWO_TABLE.has(vendorId) ? 2 : 1) as 1 | 2 })),
  ...EMERALD_IDS.map((vendorId) => ({ vendorId, room: 'emerald' as RoomId, tables: (TWO_TABLE.has(vendorId) ? 2 : 1) as 1 | 2 })),
]

export interface PlacedBooth extends BoothAssignment {
  label: string // e.g. "B1"
  index: number // 0-based within room
  x: number
  y: number
  w: number
  h: number
}

// Resolve every booth to an (x,y,w,h) inside its room's vendor grid.
export function placedBooths(roomId: RoomId): PlacedBooth[] {
  const room = rooms.find((r) => r.id === roomId)!
  const g = room.grid
  const prefix = roomId === 'burgundy' ? 'B' : 'E'
  const pad = 2.5
  const cellW = g.w / g.cols
  const cellH = g.h / g.rows
  return booths
    .filter((b) => b.room === roomId)
    .map((b, i) => {
      const col = g.order === 'row' ? i % g.cols : Math.floor(i / g.rows)
      const row = g.order === 'row' ? Math.floor(i / g.cols) : i % g.rows
      return {
        ...b,
        label: `${prefix}${i + 1}`,
        index: i,
        x: g.x + col * cellW + pad,
        y: g.y + row * cellH + pad,
        w: cellW - pad * 2,
        h: cellH - pad * 2,
      }
    })
}

export const allPlacedBooths: PlacedBooth[] = [...placedBooths('burgundy'), ...placedBooths('emerald')]

export function boothForVendor(vendorId: string): PlacedBooth | undefined {
  return allPlacedBooths.find((b) => b.vendorId === vendorId)
}

export function roomName(roomId: RoomId): string {
  return rooms.find((r) => r.id === roomId)?.name ?? ''
}

export function vendorById(id: string) {
  return vendors.find((v) => v.id === id)
}

// A color per vendor category, so booths read at a glance and match a legend.
export const CATEGORY_COLOR: Record<(typeof vendorCategories)[number], string> = {
  Art: '#e0950f',
  'Jewelry & Gifts': '#0669ac',
  'Toys & Enrichment': '#2f9e7f',
  'Beds & Comfort': '#9b6cc4',
  'Treats & Food': '#d9663d',
  'Home & Apparel': '#3aa0c4',
}
