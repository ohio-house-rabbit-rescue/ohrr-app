// The two spreadsheets of items (2026-10-27): the full one, every detail, and
// the one-page list to print (photo, item, where it's kept, donor). Used by
// Items and by the receiving summary.
import type { SheetColumn, SheetRow } from '../../lib/inventoryExport'
import { itemPhotos } from './api'
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
  { header: 'Value each', width: 12, kind: 'money' },
  { header: 'Value in all', width: 12, kind: 'money' },
  { header: 'Price', width: 10, kind: 'money' },
  { header: 'Condition', width: 11 },
  { header: 'Sort of thing', width: 16 },
  { header: 'Where it’s kept', width: 18 },
  { header: 'Use by', width: 13, kind: 'date' },
  { header: 'Description', width: 40 },
  { header: 'Label printed', width: 13, kind: 'date' },
  { header: 'Added', width: 13, kind: 'date' },
]

// The one-page list to print (OHRR 2026-10-27: "has the photo, has the item,
// has the location, and has the donor … a single sheet of paper going
// portrait"). The photo is the first column, added by the export.
export const SIMPLE_COLUMNS: SheetColumn[] = [
  { header: 'Item', width: 34 },
  { header: 'Where it’s kept', width: 24 },
  { header: 'Donor', width: 24 },
]

export function simpleRow(i: TaggedItem): SheetRow {
  const from = i.source === 'purchase' ? (i.bought_from ? `Bought at ${i.bought_from}` : 'Bought') : i.donated_by
  return { photos: itemPhotos(i), cells: [`${i.title}\n${i.code}`, i.location, from] }
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
      i.location,
      i.use_by,
      i.description,
      i.label_printed_at,
      i.created_at,
    ],
  }
}
