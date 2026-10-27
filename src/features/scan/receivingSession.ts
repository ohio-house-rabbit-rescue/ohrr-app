// What has been received on this phone today, so "I'm done" can show a
// summary of it (OHRR 2026-10-27: "let's assume that I took 5 or 10
// donations, I'd like to be able to create an executive summary printout …
// but also be able to export out as a Excel spreadsheet"). Kept for today
// only, like the drop-off being added to.
import { thumbnail } from '../../lib/inventoryExport'
import { itemPhotos } from './api'
import { donationValues, formatMoney, type TaggedItem } from './types'

const SESSION_KEY = 'ohrr.catalog.session'

export interface SessionItem {
  code: string
  /** Which bag it came in: one donor's drop-off, or one store's shopping. */
  bag: string
}

export interface ReceivingSession {
  day: string
  items: SessionItem[]
}

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function loadSession(): ReceivingSession {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as ReceivingSession | null
    if (s && s.day === todayIso() && Array.isArray(s.items)) return s
  } catch {
    /* private mode */
  }
  return { day: todayIso(), items: [] }
}

export function saveSession(s: ReceivingSession | null) {
  try {
    if (s && s.items.length) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* private mode */
  }
}

/** The bag an item belongs to: a donor's drop-off (by name and day) or a store. */
export const bagKey = (source: 'donation' | 'purchase', donor: string, date: string, boughtFrom: string) =>
  source === 'purchase' ? `p:${boughtFrom.trim().toLowerCase()}` : `d:${donor.trim().toLowerCase()}|${date}`

/** One donor's drop-off, or one store's shopping, in the summary. */
export interface SummaryGroup {
  key: string
  /** "Jane Smith", or "Bought at Tractor Supply". */
  name: string
  bought: boolean
  dropoffId: string | null
  items: TaggedItem[]
  pieces: number
  /** Value given (donations) or what we paid (bought), in cents. */
  cents: number
}

export interface SummaryTotals {
  items: number
  pieces: number
  donors: number
  given: number
  paid: number
  unprinted: number
}

const pieces = (i: TaggedItem) => Math.max(1, i.quantity ?? 1)
const bought = (i: TaggedItem) => i.source === 'purchase'
export const itemCents = (i: TaggedItem) => (bought(i) ? (i.cost_cents ?? 0) : (donationValues(i).total ?? 0))
export const fromLine = (i: TaggedItem) =>
  bought(i) ? (i.bought_from ? `Bought at ${i.bought_from}` : 'Bought') : i.donated_by || 'Someone not named'

/** The items in the order they were received, grouped by who they came from. */
export function summarize(items: TaggedItem[]): { groups: SummaryGroup[]; totals: SummaryTotals } {
  const groups: SummaryGroup[] = []
  const byKey = new Map<string, SummaryGroup>()
  for (const i of items) {
    const key = bought(i) ? `p:${(i.bought_from ?? '').toLowerCase()}` : i.dropoff_id ? `o:${i.dropoff_id}` : `d:${(i.donated_by ?? '').toLowerCase()}`
    let g = byKey.get(key)
    if (!g) {
      g = { key, name: fromLine(i), bought: bought(i), dropoffId: bought(i) ? null : (i.dropoff_id ?? null), items: [], pieces: 0, cents: 0 }
      byKey.set(key, g)
      groups.push(g)
    }
    g.items.push(i)
    g.pieces += pieces(i)
    g.cents += itemCents(i)
  }
  const totals: SummaryTotals = {
    items: items.length,
    pieces: items.reduce((n, i) => n + pieces(i), 0),
    donors: groups.filter((g) => !g.bought).length,
    given: groups.filter((g) => !g.bought).reduce((n, g) => n + g.cents, 0),
    paid: groups.filter((g) => g.bought).reduce((n, g) => n + g.cents, 0),
    unprinted: items.filter((i) => !i.label_printed_at).length,
  }
  return { groups, totals }
}

/** jsPDF's built-in fonts have no curly quotes or long dashes. */
const plain = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')

const money = (c: number) => (c ? formatMoney(c) : '')

/**
 * The executive summary, one letter page (more when it's long): the totals,
 * who it came from, then every item with its photo, where it's kept and its
 * value or what we paid.
 */
export async function receivingSummaryPdf(items: TaggedItem[], onProgress?: (msg: string) => void): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { groups, totals } = summarize(items)

  // The photos first, a few at a time.
  const thumbs = new Map<string, Awaited<ReturnType<typeof thumbnail>>>()
  let done = 0
  const queue = [...items]
  const worker = async () => {
    for (let i = queue.shift(); i; i = queue.shift()) {
      const url = itemPhotos(i)[0]
      thumbs.set(i.code, url ? await thumbnail(url) : null)
      onProgress?.(`Photos ${++done} of ${items.length}…`)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  onProgress?.('Making the PDF…')

  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const left = 0.7
  const right = 8.5 - 0.7
  const bottom = 10.3
  const when = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  let y = 0.85

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(6, 105, 172)
  doc.text('OHIO HOUSE RABBIT RESCUE', left, y)
  doc.setTextColor(20, 20, 20)
  y += 0.42
  doc.setFontSize(24)
  doc.text('Items received', left, y)
  y += 0.28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(when, left, y)
  y += 0.3

  // The totals, in boxes across the page.
  const facts: [string, string][] = [
    [String(totals.items), totals.items === 1 ? 'item' : 'items'],
    [String(totals.pieces), totals.pieces === 1 ? 'piece' : 'pieces'],
    [String(totals.donors), totals.donors === 1 ? 'donor' : 'donors'],
  ]
  if (totals.given) facts.push([formatMoney(totals.given), 'value given'])
  if (totals.paid) facts.push([formatMoney(totals.paid), 'we paid'])
  const gap = 0.12
  const w = (right - left - gap * (facts.length - 1)) / facts.length
  facts.forEach(([big, small], k) => {
    const x = left + k * (w + gap)
    doc.setFillColor(235, 244, 250)
    doc.roundedRect(x, y, w, 0.75, 0.08, 0.08, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(big, x + w / 2, y + 0.38, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(small, x + w / 2, y + 0.6, { align: 'center' })
  })
  y += 0.95
  if (totals.unprinted) {
    doc.setFontSize(11)
    doc.text(`${totals.unprinted} label${totals.unprinted === 1 ? '' : 's'} still to print.`, left, y)
    y += 0.2
  }
  y += 0.2

  // Who it came from.
  const heading = (s: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(s, left, y)
    y += 0.08
    doc.setLineWidth(0.015)
    doc.line(left, y, right, y)
    y += 0.25
  }
  heading('Who it came from')
  doc.setFontSize(11)
  for (const g of groups) {
    if (y > bottom) {
      doc.addPage('letter', 'portrait')
      y = 0.85
    }
    doc.setFont('helvetica', 'normal')
    doc.text(doc.splitTextToSize(plain(g.name), 3.6)[0], left, y)
    doc.text(`${g.items.length} item${g.items.length === 1 ? '' : 's'}${g.pieces > g.items.length ? `, ${g.pieces} pieces` : ''}`, left + 3.8, y)
    if (g.cents) doc.text(`${g.bought ? 'paid' : 'value'} ${money(g.cents)}`, right, y, { align: 'right' })
    y += 0.25
  }
  y += 0.2

  // Every item.
  const cols = { photo: left, item: left + 0.75, where: left + 3.75, from: left + 5.35 }
  const rowH = 0.72
  const itemHeader = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text('ITEM', cols.item, y)
    doc.text("WHERE IT'S KEPT", cols.where, y)
    doc.text('FROM', cols.from, y)
    doc.text('VALUE / PAID', right, y, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    y += 0.12
  }
  if (y + 0.6 + rowH > bottom) {
    doc.addPage('letter', 'portrait')
    y = 0.85
  }
  heading('What came in')
  itemHeader()
  items.forEach((i, n) => {
    if (y + rowH > bottom + 0.3) {
      doc.addPage('letter', 'portrait')
      y = 0.85
      itemHeader()
    }
    if (n % 2 === 1) {
      doc.setFillColor(247, 248, 250)
      doc.rect(left - 0.05, y, right - left + 0.1, rowH, 'F')
    }
    const t = thumbs.get(i.code)
    const box = 0.6
    if (t) {
      const s = box / Math.max(t.w, t.h)
      const tw = t.w * s
      const th = t.h * s
      doc.addImage(`data:image/jpeg;base64,${t.base64}`, 'JPEG', cols.photo + (box - tw) / 2, y + 0.06 + (box - th) / 2, tw, th)
    } else {
      doc.setDrawColor(200, 200, 200)
      doc.rect(cols.photo, y + 0.06, box, box)
    }
    const top = y + 0.24
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const name = `${plain(i.title) || 'Untitled'}${(i.quantity ?? 1) > 1 ? ` (${i.quantity})` : ''}`
    doc.text(doc.splitTextToSize(name, 2.9).slice(0, 2), cols.item, top)
    doc.setFont('courier', 'normal')
    doc.setFontSize(9)
    doc.text(i.code, cols.item, top + (doc.splitTextToSize(name, 2.9).length > 1 ? 0.38 : 0.2))
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(plain(i.location) || '-', 1.5).slice(0, 2), cols.where, top)
    doc.text(doc.splitTextToSize(plain(fromLine(i)), 1.4).slice(0, 2), cols.from, top)
    doc.text(money(itemCents(i)), right, top, { align: 'right' })
    y += rowH
  })

  // Page numbers.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(`Ohio House Rabbit Rescue - items received ${plain(when)}`, left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return doc.output('blob')
}
