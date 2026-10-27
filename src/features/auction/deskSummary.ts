// The end of an auction day, on the Auction desk ("I'm done"): how many items,
// how many sold, what is paid, taken, still to ship or still unpaid, and the
// money in — as a list you can filter, a spreadsheet and a PDF to print or send.
// The same pattern as the volunteer call summary (volunteers/callSummary.ts).
// Staff audit, 2026-10-27.
import type { SheetSpec } from '../../lib/inventoryExport'
import { FULFIL_LABEL, PAYMENT_LABEL, fmtWhen, money, sessionLabel, type AuctionItem, type AuctionSettings, type Bidder, type Fulfil, type Sale } from './client'

/** One row of auction_desk(): an item with its high bidder, bids and sale. */
export interface DeskItem extends AuctionItem {
  is_published: boolean
  high_bidder: { id: string; name: string; email: string; phone: string | null; bidder_no: number; fulfil: Fulfil } | null
  bids: { amount_cents: number; kind: string; at: string; is_high: boolean; bidder_no: number | null; name: string | null }[]
  sale: Sale | null
}
export interface DeskBidder extends Omit<Bidder, 'access_token'> {
  bids: number
  won: number
}
export interface DeskData {
  now: string
  settings: AuctionSettings | null
  items: DeskItem[]
  bidders: DeskBidder[]
  totals: { paid_cents: number; pending_cents: number; failed: number; sold: number; to_ship: number; to_pick_up: number }
}

export type DoneFilter = 'all' | 'paid' | 'taken' | 'ship' | 'unpaid'
export const DONE_FILTERS: { id: DoneFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'taken', label: 'Taken' },
  { id: 'ship', label: 'To ship' },
  { id: 'unpaid', label: 'Unpaid' },
]

/** A sale that still stands (not canceled, not refunded). */
const standing = (s: Sale | null): s is Sale => !!s && s.payment_status !== 'void' && s.payment_status !== 'refunded'
const isPaid = (s: Sale) => s.payment_status === 'paid' || s.payment_status === 'cash'
const isUnpaid = (s: Sale) => s.payment_status === 'pending' || s.payment_status === 'failed'

export interface DoneTotals {
  items: number
  sold: number
  notSold: number
  paid: number
  taken: number
  toPickUp: number
  toShip: number
  shipped: number
  unpaid: number
  unpaidCents: number
  moneyInCents: number
}

export function doneTotals(items: DeskItem[]): DoneTotals {
  const t: DoneTotals = { items: items.length, sold: 0, notSold: 0, paid: 0, taken: 0, toPickUp: 0, toShip: 0, shipped: 0, unpaid: 0, unpaidCents: 0, moneyInCents: 0 }
  for (const i of items) {
    const s = i.sale
    if (standing(s)) {
      t.sold += 1
      if (isPaid(s)) {
        t.paid += 1
        t.moneyInCents += s.total_cents
        if (s.fulfil_status === 'picked_up') t.taken += 1
        else if (s.fulfil_status === 'shipped') t.shipped += 1
        else if (s.fulfil === 'ship') t.toShip += 1
        else t.toPickUp += 1
      } else if (isUnpaid(s)) {
        t.unpaid += 1
        t.unpaidCents += s.total_cents
      }
    } else if (!s && i.status === 'won') {
      // Marked won by hand on the Silent Auction screen: no sale to check.
      t.sold += 1
    }
  }
  t.notSold = t.items - t.sold
  return t
}

export interface DoneRow {
  item: DeskItem
  sale: Sale | null
  buyer: string
  /** "Paid · picked up", "Card declined", "Not sold" … */
  status: string
  totalCents: number | null
}

const buyerOf = (i: DeskItem): string => {
  const b = i.sale?.buyer
  if (b?.name) return `${b.name}${b.bidder_no != null ? ` (#${b.bidder_no})` : ''}`
  return i.sale ? 'Walk-up' : ''
}

function statusOf(i: DeskItem): string {
  const s = i.sale
  if (!s) return i.status === 'won' ? 'Marked won' : 'Not sold'
  if (s.payment_status === 'void' || s.payment_status === 'refunded') return PAYMENT_LABEL[s.payment_status]
  if (isPaid(s)) return `${PAYMENT_LABEL[s.payment_status]} · ${s.fulfil_status === 'pending' ? (s.fulfil === 'ship' ? 'to ship' : 'to pick up') : FULFIL_LABEL[s.fulfil_status].toLowerCase()}`
  return PAYMENT_LABEL[s.payment_status]
}

export function doneRows(items: DeskItem[], filter: DoneFilter): DoneRow[] {
  const rows: DoneRow[] = items.map((item) => ({
    item,
    sale: item.sale,
    buyer: buyerOf(item),
    status: statusOf(item),
    totalCents: standing(item.sale) ? item.sale.total_cents : null,
  }))
  const keep = (r: DoneRow): boolean => {
    const s = r.sale
    switch (filter) {
      case 'all':
        return true
      case 'paid':
        return standing(s) && isPaid(s)
      case 'taken':
        return standing(s) && isPaid(s) && s.fulfil_status === 'picked_up'
      case 'ship':
        return standing(s) && isPaid(s) && s.fulfil === 'ship' && s.fulfil_status !== 'shipped'
      case 'unpaid':
        return standing(s) && isUnpaid(s)
    }
  }
  return rows.filter(keep).sort((a, b) => a.item.title.localeCompare(b.item.title, undefined, { sensitivity: 'base' }))
}

const today = () => new Date().toLocaleDateString('en-CA')

export function filterWord(f: DoneFilter): string {
  return f === 'all' ? 'all items' : f === 'paid' ? 'paid' : f === 'taken' ? 'taken' : f === 'ship' ? 'to ship' : 'unpaid'
}

export function doneSheet(rows: DoneRow[], opts: { slug: string; auctionName: string; eventName: string; filter: DoneFilter; online: boolean }): SheetSpec {
  return {
    filename: `ohrr-auction-desk-${opts.slug}-${today()}`,
    sheetName: 'Auction',
    title: `${opts.auctionName} - ${opts.eventName} - ${filterWord(opts.filter)} - made ${new Date().toLocaleDateString('en-US')}`,
    columns: [
      { header: 'Item', width: 32 },
      { header: 'Session', width: 12 },
      { header: 'Buyer', width: 24 },
      { header: 'Email', width: 28 },
      { header: 'Phone', width: 16 },
      { header: 'Price', width: 10, kind: 'money' },
      { header: 'Shipping', width: 10, kind: 'money' },
      { header: 'Total', width: 10, kind: 'money' },
      { header: 'Payment', width: 18 },
      { header: 'Pickup or ship', width: 14 },
      { header: 'Handed over', width: 14 },
      { header: 'Tracking', width: 20 },
    ],
    rows: rows.map((r) => {
      const s = standing(r.sale) ? r.sale : null
      return {
        photos: [],
        cells: [
          r.item.title,
          opts.online ? 'Online' : sessionLabel(r.item.session),
          r.buyer,
          s?.buyer.email ?? '',
          s?.buyer.phone ?? '',
          s ? s.amount_cents : null,
          s && s.ship_fee_cents > 0 ? s.ship_fee_cents : null,
          s ? s.total_cents : null,
          r.sale ? PAYMENT_LABEL[r.sale.payment_status] : r.status,
          s ? (s.fulfil === 'ship' ? 'Ship' : 'Pickup') : '',
          s ? FULFIL_LABEL[s.fulfil_status] : '',
          s?.tracking ?? '',
        ],
      }
    }),
  }
}

const plain = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/·/g, '-')
    .replace(/…/g, '...')

/** One letter page (more when long): the auction, the totals, every item with who has it. */
export async function doneSummaryPdf(
  data: DeskData,
  rows: DoneRow[],
  opts: { orgName: string; auctionName: string; eventName: string; filter: DoneFilter },
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const t = doneTotals(data.items)
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const left = 0.7
  const right = 8.5 - 0.7
  const bottom = 10.3
  let y = 0.85
  const page = () => {
    doc.addPage('letter', 'portrait')
    y = 0.85
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(6, 105, 172)
  doc.text(plain(opts.orgName || 'OHIO HOUSE RABBIT RESCUE').toUpperCase(), left, y)
  doc.setTextColor(20, 20, 20)
  y += 0.42
  doc.setFontSize(22)
  doc.text(plain(`${opts.auctionName} - the day's summary`), left, y)
  y += 0.3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(plain(`${opts.eventName} - ${filterWord(opts.filter)} - made ${new Date().toLocaleDateString('en-US')}`), left, y)
  y += 0.35

  const facts: [string, string][] = [
    [String(t.items), 'items'],
    [String(t.sold), 'sold'],
    [String(t.paid), 'paid'],
    [String(t.taken), 'taken'],
    [String(t.toShip), 'to ship'],
    [String(t.unpaid), 'unpaid'],
    [money(t.moneyInCents) || '$0', 'money in'],
  ]
  const gap = 0.08
  const w = (right - left - gap * (facts.length - 1)) / facts.length
  facts.forEach(([big, small], k) => {
    const x = left + k * (w + gap)
    doc.setFillColor(235, 244, 250)
    doc.roundedRect(x, y, w, 0.75, 0.08, 0.08, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(big.length > 6 ? 13 : 17)
    doc.text(big, x + w / 2, y + 0.4, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(small, x + w / 2, y + 0.62, { align: 'center' })
  })
  y += 1.0
  if (t.unpaid) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(plain(`Still owed: ${money(t.unpaidCents)} on ${t.unpaid} item${t.unpaid === 1 ? '' : 's'}.`), left, y)
    y += 0.25
  }
  y += 0.1

  const cols = { item: left, buyer: left + 2.7, total: left + 5.0, status: right }
  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text('ITEM', cols.item, y)
    doc.text('BUYER', cols.buyer, y)
    doc.text('TOTAL', cols.total, y, { align: 'right' })
    doc.text('STATUS', cols.status, y, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    y += 0.2
  }
  header()
  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('Nothing in this list.', left, y)
  }
  rows.forEach((r, n) => {
    if (y + 0.3 > bottom) {
      page()
      header()
    }
    if (n % 2 === 1) {
      doc.setFillColor(247, 248, 250)
      doc.rect(left - 0.05, y - 0.17, right - left + 0.1, 0.26, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(plain(r.item.title) || '-', 2.55)[0], cols.item, y)
    doc.text(doc.splitTextToSize(plain(r.buyer) || '-', 2.1)[0], cols.buyer, y)
    doc.text(r.totalCents != null ? money(r.totalCents) : '-', cols.total, y, { align: 'right' })
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(plain(r.status), 1.7)[0], cols.status, y, { align: 'right' })
    y += 0.26
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(plain(`${opts.orgName || 'Ohio House Rabbit Rescue'} - ${opts.auctionName}, ${fmtWhen(data.now)}`), left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return doc.output('blob')
}
