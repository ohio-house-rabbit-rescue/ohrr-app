// Inventory as a spreadsheet, with a photo in every row (2026-10-24, sponsor:
// "Can the web version export the inventory with a photo? This would be
// donations, inventory, and any other item like it").
//
// An Excel file (.xlsx): the first column holds a small picture of the item's
// cover photo, sitting in its cell; the last column has the web address of
// every photo, so the full-size ones are a click away (and survive in Google
// Sheets, which drops pictures that sit over cells). Money is real money and
// dates are real dates, so the sheet can be sorted and added up. A plain CSV
// (photo addresses, no pictures) is offered beside it.
//
// The same as the website's src/lib/inventoryExport.ts, except that here the
// file comes back as a Blob: on the phone it goes to the share sheet, so it
// can be emailed straight away (sponsor: "That way they can email from the
// phone also"). See components/ExportButtons.tsx.
//
// The pictures are made in the browser: each photo is fetched from storage
// (Supabase sends Access-Control-Allow-Origin: *), shrunk to a thumbnail and
// put in the file — nothing is uploaded anywhere. exceljs (MIT) is loaded only
// when someone downloads.
import { toCsv } from './exportFile'

export type ColumnKind = 'text' | 'number' | 'money' | 'date'

export interface SheetColumn {
  header: string
  /** Width in characters. */
  width?: number
  kind?: ColumnKind
}

export interface SheetRow {
  /** All the photos, cover first. */
  photos: string[]
  /** One value per column: money in cents, dates as YYYY-MM-DD or ISO. */
  cells: unknown[]
}

export interface SheetSpec {
  /** Without the extension. */
  filename: string
  sheetName: string
  /** A line above the table: what is in it and when it was made. */
  title: string
  columns: SheetColumn[]
  rows: SheetRow[]
  /**
   * 'print': a short list made to print on letter paper standing up — no
   * photo-links column, one page wide, the headings repeated on every page.
   * OHRR (2026-10-27): "a version that is simple … has the photo, has the
   * item, has the location, and has the donor … a single sheet of paper going
   * portrait".
   */
  layout?: 'full' | 'print'
}

const THUMB_PX = 96
const ROW_PT = 78 // about 104 px, room for the picture and a margin

/** Cells as the spreadsheet should hold them. */
function value(v: unknown, kind: ColumnKind = 'text'): unknown {
  if (v == null || v === '') return null
  if (kind === 'money') return typeof v === 'number' ? v / 100 : null
  if (kind === 'number') return typeof v === 'number' ? v : Number(v) || null
  if (kind === 'date') {
    const s = String(v)
    // A plain date stays that day wherever the sheet is opened.
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s)
    return Number.isNaN(d.getTime()) ? s : d
  }
  return String(v)
}

/** A photo shrunk to a thumbnail: JPEG bytes and its size in pixels, or null. */
async function thumbnail(url: string): Promise<{ base64: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const bmp = await createImageBitmap(await res.blob())
    const scale = Math.min(1, (THUMB_PX * 2) / Math.max(bmp.width, bmp.height)) // 2x for sharp screens
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(bmp.width * scale))
    c.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const base64 = c.toDataURL('image/jpeg', 0.82).split(',')[1]
    const fit = THUMB_PX / Math.max(c.width, c.height)
    return { base64, w: Math.round(c.width * fit), h: Math.round(c.height * fit) }
  } catch {
    return null
  }
}

/** Run `fn` over `list`, a few at a time. */
async function eachLimit<T>(list: T[], limit: number, fn: (t: T, i: number) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < list.length) {
      const i = next++
      await fn(list[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker))
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Build the Excel file. `onProgress` hears how many photos are done. Also
 * says how many photos couldn't be fetched (the row keeps its link).
 */
export async function buildSheetWithPhotos(spec: SheetSpec, onProgress?: (done: number, total: number) => void): Promise<{ blob: Blob; missing: number }> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Ohio House Rabbit Rescue'
  wb.created = new Date()
  const print = spec.layout === 'print'
  const ws = wb.addWorksheet(spec.sheetName, {
    views: [{ state: 'frozen', ySplit: 2, xSplit: print ? 0 : 1 }],
    pageSetup: print
      ? {
          // Paper left to the printer (letter here); exceljs has no "letter" value to set.
          orientation: 'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0, // as many pages down as it needs
          horizontalCentered: true,
          margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
          printTitlesRow: '2:2',
        }
      : undefined,
  })

  const cols: SheetColumn[] = print
    ? [{ header: 'Photo', width: 15 }, ...spec.columns]
    : [{ header: 'Photo', width: 15 }, ...spec.columns, { header: 'Photo links', width: 50 }]
  ws.columns = cols.map((c) => ({
    width: c.width ?? 16,
    style: c.kind === 'money' ? { numFmt: '"$"#,##0.00' } : c.kind === 'date' ? { numFmt: 'mmm d, yyyy' } : {},
  }))

  // Row 1: what this is. Row 2: the headings.
  ws.getCell(1, 1).value = spec.title
  ws.getCell(1, 1).font = { bold: true, size: 13 }
  if (print) {
    // Kept inside the page: across the table, wrapped.
    ws.mergeCells(1, 1, 1, cols.length)
    ws.getCell(1, 1).alignment = { wrapText: true, vertical: 'middle' }
    ws.getRow(1).height = 36
  }
  const head = ws.getRow(2)
  cols.forEach((c, i) => {
    const cell = head.getCell(i + 1)
    cell.value = c.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0669AC' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  head.height = 30
  if (!print) ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } }
  else ws.headerFooter = { oddFooter: '&LOhio House Rabbit Rescue&RPage &P of &N' }

  spec.rows.forEach((r, i) => {
    const row = ws.getRow(i + 3)
    spec.columns.forEach((c, j) => {
      row.getCell(j + 2).value = value(r.cells[j], c.kind) as never
    })
    if (!print) {
      const links = row.getCell(cols.length)
      links.value = r.photos.join('\n') || null
      if (r.photos.length === 1) links.value = { text: r.photos[0], hyperlink: r.photos[0] }
    }
    row.height = r.photos.length ? ROW_PT : print ? 32 : 20 // the print list's item cell has two lines
    row.alignment = { vertical: 'top', wrapText: true }
  })

  const withPhoto = spec.rows.map((r, i) => ({ url: r.photos[0], i })).filter((x) => !!x.url)
  let done = 0
  let missing = 0
  onProgress?.(0, withPhoto.length)
  await eachLimit(withPhoto, 6, async ({ url, i }) => {
    const t = await thumbnail(url)
    if (t) {
      const id = wb.addImage({ base64: t.base64, extension: 'jpeg' })
      // Inside the photo cell, a little in from the corner; it moves with its row when sorted.
      ws.addImage(id, { tl: { col: 0.08, row: i + 2 + 0.06 }, ext: { width: t.w, height: t.h }, editAs: 'oneCell' })
    } else {
      missing++
      ws.getRow(i + 3).getCell(1).value = 'Photo didn’t load — see the link'
    }
    onProgress?.(++done, withPhoto.length)
  })

  const buf = await wb.xlsx.writeBuffer()
  return { blob: new Blob([buf], { type: XLSX_TYPE }), missing }
}

/** The same table as a CSV: photo addresses instead of pictures. */
export function sheetCsvBlob(spec: SheetSpec): Blob {
  const text = (v: unknown, kind?: ColumnKind) => {
    if (v == null || v === '') return ''
    if (kind === 'money') return typeof v === 'number' ? (v / 100).toFixed(2) : ''
    if (kind === 'date') return String(v).slice(0, 10)
    return v
  }
  const csv = toCsv(
    [...spec.columns.map((c) => c.header), 'Photo links'],
    spec.rows.map((r) => [...spec.columns.map((c, j) => text(r.cells[j], c.kind)), r.photos.join(' ')]),
  )
  return new Blob([csv], { type: 'text/csv;charset=utf-8' })
}

export const todayStamp = () => new Date().toISOString().slice(0, 10)
