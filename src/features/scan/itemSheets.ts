// The two spreadsheets of items (2026-10-27): the full one, every detail, and
// the one-page list to print (photo, item, where it's kept, donor). Used by
// Items and by the receiving summary.
import type { SheetColumn, SheetRow } from '../../lib/inventoryExport'
import { itemPhotos } from './api'
import { boxTitle } from './codes'
import { keptAt } from './sheetSave'
import { KIND_META, conditionLabel, donationValues, headedLabel, statusLabel, type TaggedItem } from './types'

// The spreadsheet's columns, the same as the website's Items download.
export const SHEET_COLUMNS: SheetColumn[] = [
  { header: 'Number', width: 14 },
  { header: 'Name', width: 32 },
  { header: 'Kind', width: 20 },
  { header: 'Status', width: 26 },
  { header: 'Donated by', width: 22 },
  { header: 'Received', width: 13, kind: 'date' },
  { header: 'Headed for', width: 15 },
  { header: 'What it’s for', width: 18 },
  { header: 'Came in as', width: 12 },
  { header: 'What we paid', width: 12, kind: 'money' },
  { header: 'Bought from', width: 18 },
  { header: 'How many', width: 10, kind: 'number' },
  { header: 'Size', width: 12 },
  { header: 'Worth each', width: 12, kind: 'money' },
  { header: 'Worth in all', width: 12, kind: 'money' },
  { header: 'Price', width: 10, kind: 'money' },
  { header: 'Condition', width: 11 },
  { header: 'Sort of thing', width: 16 },
  { header: 'Where it’s kept', width: 18 },
  { header: 'Box', width: 16 },
  { header: 'Use by', width: 13, kind: 'date' },
  { header: 'Notes', width: 40 },
  { header: 'Label printed', width: 13, kind: 'date' },
  { header: 'Added', width: 13, kind: 'date' },
]

// The one-page list to print (OHRR 2026-10-27: "has the photo, has the item,
// has the location, and has the donor … a single sheet of paper going
// portrait"). The photo is the first column, added by the export.
export const SIMPLE_COLUMNS: SheetColumn[] = [
  { header: 'Item', width: 34 },
  { header: 'Where it’s kept', width: 24 },
  { header: 'Donated by', width: 24 },
]

export function simpleRow(i: TaggedItem): SheetRow {
  const from = i.source === 'purchase' ? (i.bought_from ? `Bought at ${i.bought_from}` : 'Bought') : i.donated_by
  return { photos: itemPhotos(i), cells: [`${i.title}\n${i.code}`, keptAt(i) || null, from] }
}

/** The box an item is in, as written on the box: "Box 12", or "Box 12 · Raffle box · 1 of 4" when it has a name. */
export function boxCell(b: TaggedItem['box']): string | null {
  if (!b) return null
  const n = `Box ${b.box_no}`
  const t = boxTitle(b)
  return t === n ? n : `${n} · ${t}`
}

export function sheetRow(i: TaggedItem): SheetRow {
  const v = i.kind === 'donation' ? donationValues(i) : { each: null, total: i.value_cents }
  return {
    photos: itemPhotos(i),
    cells: [
      i.code,
      i.title,
      KIND_META[i.kind].label,
      statusLabel(i),
      i.donated_by,
      i.received_on,
      headedLabel(i.headed_for),
      i.purpose ?? null,
      i.kind === 'donation' ? (i.source === 'purchase' ? 'Bought' : 'Donation') : null,
      i.cost_cents ?? null,
      i.bought_from ?? null,
      i.quantity,
      i.size,
      v.each,
      v.total,
      i.price_cents,
      conditionLabel(i.condition),
      i.category,
      keptAt(i) || null,
      boxCell(i.box),
      i.use_by,
      i.description,
      i.label_printed_at,
      i.created_at,
    ],
  }
}
