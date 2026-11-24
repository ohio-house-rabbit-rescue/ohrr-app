// "Report with photos": the list the Items spreadsheet is showing, as a PDF
// with the item's photos on its own line (2026-11-22, sponsor: "generate a PDF
// report that will have the images on the line item").
//
// Letter paper standing up. A short heading (what list, how many, total
// worth), then one line per item: up to four photos on the left (the cover
// big, the others small beside it), and on the right the name, number, how
// many and status, then the details the person chose (REPORT_FIELDS: box,
// where it's kept, worth, donor, notes …, as many as fit beside the photo).
// Made in the browser with jsPDF (already used for labels):
// each photo is fetched from storage and shrunk first, nothing is uploaded.
//
// It reads the same table the spreadsheet download uses (columns found by
// their heading), so the app and the website build the identical report.
// The app keeps this file in src/features/scan/, the website in src/lib/ —
// keep the two the same.

export interface ReportSpec {
  filename: string
  title: string
  columns: { header: string }[]
  rows: { photos: string[]; cells: unknown[] }[]
}

interface Thumb {
  data: string
  w: number
  h: number
}

/** A photo shrunk to `px` on its long side, as JPEG data, or null when it can't be fetched. */
async function shrink(url: string, px: number): Promise<Thumb | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const bmp = await createImageBitmap(await res.blob())
    const scale = Math.min(1, px / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(bmp.width * scale))
    c.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    return { data: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height }
  } catch {
    return null
  }
}

/** jsPDF's built-in fonts have no curly quotes, long dashes or ellipses. */
const plain = (s: unknown): string =>
  (s == null ? '' : String(s))
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')
    .replace(/·/g, '-')
    .replace(/[^\x20-\x7e\n -ÿ]/g, '')
    .trim()

const money = (cents: unknown): string =>
  typeof cents === 'number' && cents > 0 ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}` : ''

const day = (v: unknown): string => {
  if (v == null || v === '') return ''
  const s = String(v)
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s)
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * What can go next to the photos (sponsor 2026-11-23: "there needs to be an option of what to include in the
 * PDF but limit it to the selections that will fit"). The name, number and status are always there. A line
 * has room for six details beside the cover photo (three rows of two); the notes are two full lines, so they
 * take two of the six. The page stops a seventh being chosen, so each line stays the height of its photo.
 */
export type ReportField = 'box' | 'kept' | 'worth' | 'condition' | 'donor' | 'size' | 'sort' | 'received' | 'useBy' | 'notes'
export const REPORT_FIELDS: { key: ReportField; label: string; spaces: number }[] = [
  { key: 'box', label: 'Box number', spaces: 1 },
  { key: 'kept', label: 'Where it’s kept', spaces: 1 },
  { key: 'worth', label: 'Worth (or what we paid)', spaces: 1 },
  { key: 'condition', label: 'Condition', spaces: 1 },
  { key: 'donor', label: 'Donor (or where it was bought)', spaces: 1 },
  { key: 'size', label: 'Size', spaces: 1 },
  { key: 'sort', label: 'Sort of thing', spaces: 1 },
  { key: 'received', label: 'Date received', spaces: 1 },
  { key: 'useBy', label: 'Use by', spaces: 1 },
  { key: 'notes', label: 'Notes (2 lines)', spaces: 2 },
]
export const REPORT_SPACES = 6
export const DEFAULT_REPORT_FIELDS: ReportField[] = ['box', 'kept', 'worth', 'condition', 'donor', 'size']

/** Spaces the chosen details take. */
export const spacesUsed = (fields: readonly ReportField[]): number =>
  fields.reduce((n, k) => n + (REPORT_FIELDS.find((f) => f.key === k)?.spaces ?? 0), 0)

/** A saved choice made safe: known keys only, in the list's order, and no more than fits. */
export function cleanFields(raw: unknown): ReportField[] {
  if (!Array.isArray(raw)) return [...DEFAULT_REPORT_FIELDS]
  const out: ReportField[] = []
  for (const f of REPORT_FIELDS) if (raw.includes(f.key) && spacesUsed([...out, f.key]) <= REPORT_SPACES) out.push(f.key)
  return out
}

/** How many photos each line shows: the cover plus up to three more. */
const PER_LINE = 4
/** Room for a detail's label ("Condition", "Bought at") before its value. */
const LABEL_W = 0.78

/** The first `n` wrapped lines, the last ending in "..." when some were left out. */
function upTo(lines: string[], n: number): string[] {
  const kept = lines.filter((l) => l.trim())
  if (kept.length <= n) return kept
  const out = kept.slice(0, n)
  out[n - 1] = `${out[n - 1].replace(/\s+\S*$/, '')}...`
  return out
}

/** Build the PDF. `onProgress` hears a short line to show on the button. */
export async function itemsReportPdf(
  spec: ReportSpec,
  onProgress?: (msg: string) => void,
  fields: readonly ReportField[] = DEFAULT_REPORT_FIELDS,
): Promise<{ blob: Blob; missing: number }> {
  const want = cleanFields(fields)
  const col = (header: string) => spec.columns.findIndex((c) => c.header === header)
  const at = (cells: unknown[], header: string): unknown => {
    const i = col(header)
    return i < 0 ? null : cells[i]
  }

  // The photos first, a few at a time: the cover sharp enough to print, the others smaller.
  const jobs: { row: number; slot: number; url: string }[] = []
  spec.rows.forEach((r, row) => r.photos.slice(0, PER_LINE).forEach((url, slot) => url && jobs.push({ row, slot, url })))
  const thumbs = new Map<string, Thumb | null>()
  let done = 0
  let missing = 0
  let next = 0
  onProgress?.(jobs.length ? `Photos 0 of ${jobs.length}…` : 'Making the PDF…')
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++]
      const t = await shrink(j.url, j.slot === 0 ? 360 : 180)
      if (!t) missing++
      thumbs.set(`${j.row}:${j.slot}`, t)
      onProgress?.(`Photos ${++done} of ${jobs.length}…`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker))
  onProgress?.('Making the PDF…')

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait', compress: true })
  const left = 0.6
  const right = 8.5 - 0.6
  const bottom = 10.35
  let y = 0.8

  // Heading.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(6, 105, 172)
  doc.text('OHIO HOUSE RABBIT RESCUE', left, y)
  doc.setTextColor(20, 20, 20)
  y += 0.4
  doc.setFontSize(20)
  doc.text('Items report', left, y)
  y += 0.27
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  const sub = doc.splitTextToSize(plain(spec.title.replace(/^Ohio House Rabbit Rescue\s*[—-]\s*/, '')), right - left) as string[]
  doc.text(sub.slice(0, 2), left, y)
  y += 0.18 * Math.min(2, sub.length) + 0.12

  // Totals in boxes across the page.
  const pieces = spec.rows.reduce((n, r) => n + Math.max(1, Number(at(r.cells, 'How many')) || 1), 0)
  const worth = spec.rows.reduce((n, r) => {
    const c = at(r.cells, 'Value in all')
    return n + (typeof c === 'number' ? c : 0)
  }, 0)
  const withPhoto = spec.rows.filter((r) => r.photos.length > 0).length
  const facts: [string, string][] = [
    [String(spec.rows.length), spec.rows.length === 1 ? 'item' : 'items'],
    [String(pieces), pieces === 1 ? 'piece' : 'pieces'],
    [money(worth) || '$0', 'worth in all'],
    [String(withPhoto), withPhoto === 1 ? 'has a photo' : 'have a photo'],
  ]
  const gap = 0.12
  const boxW = (right - left - gap * (facts.length - 1)) / facts.length
  facts.forEach(([big, small], k) => {
    const x = left + k * (boxW + gap)
    doc.setFillColor(235, 244, 250)
    doc.roundedRect(x, y, boxW, 0.7, 0.08, 0.08, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(17)
    doc.text(big, x + boxW / 2, y + 0.36, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.text(small, x + boxW / 2, y + 0.57, { align: 'center' })
  })
  y += 0.95

  // One line per item.
  const big = 1.15 // the cover photo
  const small = (big - 0.07) / 2 // the others, two by two beside it
  const textX = left + big + 0.08 + big + 0.18
  const textW = right - textX
  const half = (textW - 0.15) / 2

  const drawPhoto = (t: Thumb | null | undefined, x: number, top: number, size: number) => {
    if (t) {
      const s = size / Math.max(t.w, t.h)
      const w = t.w * s
      const h = t.h * s
      doc.addImage(t.data, 'JPEG', x + (size - w) / 2, top + (size - h) / 2, w, h, undefined, 'FAST')
    } else {
      doc.setDrawColor(210, 210, 210)
      doc.setLineWidth(0.01)
      doc.rect(x, top, size, size)
    }
  }

  spec.rows.forEach((r, row) => {
    // What goes on the right, measured first so the line is tall enough for it.
    const qty = Math.max(1, Number(at(r.cells, 'How many')) || 1)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    const name = upTo(doc.splitTextToSize(`${plain(at(r.cells, 'Name')) || 'No name yet'}${qty > 1 ? ` (${qty})` : ''}`, textW) as string[], 2)
    const each = at(r.cells, 'Value each')
    const all = at(r.cells, 'Value in all')
    const worthText = money(all) ? `${money(all)}${qty > 1 && money(each) ? ` (${money(each)} each)` : ''}` : ''
    const bought = plain(at(r.cells, 'Came in as')) === 'Bought'
    const choices: Partial<Record<ReportField, [string, string]>> = {
      // "Box  12", not "Box  Box 12": the label already says it.
      box: ['Box', plain(at(r.cells, 'Box')).replace(/^Box\s+/, '')],
      kept: ['Kept', plain(at(r.cells, 'Where it’s kept'))],
      worth: [bought ? 'Paid' : 'Worth', bought ? money(at(r.cells, 'What we paid')) : worthText],
      condition: ['Condition', plain(at(r.cells, 'Condition'))],
      donor: [bought ? 'Bought at' : 'Donor', plain(bought ? at(r.cells, 'Bought from') : at(r.cells, 'Donated by'))],
      size: ['Size', plain(at(r.cells, 'Size'))],
      sort: ['Sort', plain(at(r.cells, 'Sort of thing'))],
      received: ['Received', day(at(r.cells, 'Received'))],
      useBy: ['Use by', day(at(r.cells, 'Use by'))],
    }
    const details = want
      .map((k) => choices[k])
      .filter((d): d is [string, string] => Boolean(d && d[1]))
      .map(([label, v]) => {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        return [label, upTo(doc.splitTextToSize(v, half - LABEL_W) as string[], 2)] as [string, string[]]
      })
    // Two details side by side; a pair is as tall as its longer value.
    const pairH: number[] = []
    for (let k = 0; k < details.length; k += 2) pairH.push(0.02 + 0.152 * Math.max(details[k][1].length, details[k + 1]?.[1].length ?? 1))
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(9)
    const notes = want.includes('notes') ? upTo(doc.splitTextToSize(plain(at(r.cells, 'Description')), textW) as string[], 2) : []
    const textH = 0.15 + 0.19 * name.length + 0.2 + pairH.reduce((a, b) => a + b, 0) + notes.length * 0.15
    const lineH = Math.max(big + 0.17, textH + 0.1)

    if (y + lineH > bottom) {
      doc.addPage('letter', 'portrait')
      y = 0.7
    }
    if (row % 2 === 1) {
      doc.setFillColor(247, 248, 250)
      doc.rect(left - 0.08, y - 0.06, right - left + 0.16, lineH, 'F')
    }

    // Photos.
    const top = y
    if (r.photos.length === 0) {
      doc.setDrawColor(210, 210, 210)
      doc.setLineWidth(0.01)
      doc.rect(left, top, big, big)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(140, 140, 140)
      doc.text('No photo', left + big / 2, top + big / 2 + 0.04, { align: 'center' })
      doc.setTextColor(20, 20, 20)
    } else {
      drawPhoto(thumbs.get(`${row}:0`), left, top, big)
      const gx = left + big + 0.08
      for (let s = 1; s < Math.min(PER_LINE, r.photos.length); s++) {
        const k = s - 1
        drawPhoto(thumbs.get(`${row}:${s}`), gx + (k % 2) * (small + 0.07), top + Math.floor(k / 2) * (small + 0.07), small)
      }
    }

    // Name and number.
    let ty = top + 0.15
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(name, textX, ty)
    ty += 0.19 * name.length
    doc.setFont('courier', 'bold')
    doc.setFontSize(9.5)
    doc.text(plain(at(r.cells, 'Number')), textX, ty)
    const status = plain(at(r.cells, 'Status'))
    if (status) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(90, 90, 90)
      doc.text(doc.splitTextToSize(status, textW - 1.3)[0] as string, right, ty, { align: 'right' })
      doc.setTextColor(20, 20, 20)
    }
    ty += 0.2

    // The details, in two columns of "label  value".
    doc.setFontSize(9.5)
    details.forEach(([label, v], k) => {
      const x = textX + (k % 2) * (half + 0.15)
      const fy = ty + pairH.slice(0, Math.floor(k / 2)).reduce((a, b) => a + b, 0)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100, 100, 100)
      doc.text(label, x, fy)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(20, 20, 20)
      doc.text(v, x + LABEL_W, fy)
    })
    ty += pairH.reduce((a, b) => a + b, 0)

    // Notes: two lines at most.
    if (notes.length) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(80, 80, 80)
      doc.text(notes, textX, ty + 0.02)
      doc.setTextColor(20, 20, 20)
    }

    y += lineH
  })

  // Page numbers.
  const pages = doc.getNumberOfPages()
  const made = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Ohio House Rabbit Rescue - items report, ${made}`, left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return { blob: doc.output('blob'), missing }
}
