// The end of the raffle ("I'm done"): tickets sold, the money, who won what and
// who still has to be reached — as a PDF to print or send, and as a spreadsheet
// of every ticket sale. The same pattern as the volunteer call summary
// (volunteers/callSummary.ts). Staff audit, 2026-10-27.
//
// There is no record of a prize being handed over (that would need a database
// column), so the PDF prints a "Handed over" box beside every winner to tick on
// paper, and the spreadsheet has a blank "Handed over" column.
import type { SheetSpec } from '../../../lib/inventoryExport'
import { money, ticketLabel, ticketRange, type DeskSummary, type RaffleOrder, type RaffleWinner } from './api'

export interface RafflePrize {
  id: string
  title: string
  status: 'available' | 'drawn'
}

export interface RaffleTotals {
  ticketsSold: number
  moneyCents: number
  /** Reservations made in the app that haven't paid yet. */
  toPay: number
  winners: number
  prizes: number
  prizesDrawn: number
}

export function raffleTotals(summary: DeskSummary | null, winners: RaffleWinner[], prizes: RafflePrize[]): RaffleTotals {
  return {
    ticketsSold: summary?.paid_tickets ?? 0,
    moneyCents: summary?.paid_cents ?? 0,
    toPay: summary?.reserved ?? 0,
    winners: Math.max(summary?.drawn ?? 0, winners.length),
    prizes: prizes.length,
    prizesDrawn: prizes.filter((p) => p.status === 'drawn').length,
  }
}

const today = () => new Date().toLocaleDateString('en-CA')

const statusWord = (s: RaffleOrder['status']) => (s === 'paid' ? 'Paid' : s === 'void' ? 'Void' : 'To pay')

/** Every ticket sale, newest first, with the numbers and any winning ticket. */
export function raffleSheet(orders: RaffleOrder[], eventName: string): SheetSpec {
  const rows = [...orders]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((o) => {
      const won = o.tickets.filter((t) => t.drawn_at)
      return {
        photos: [],
        cells: [
          o.name,
          o.phone ?? '',
          o.email ?? '',
          o.qty,
          ticketRange(o.tickets),
          o.amount_cents,
          statusWord(o.status),
          o.source === 'table' ? 'At the table' : 'In the app',
          won.map((t) => `${ticketLabel(t.no)}${t.prize ? ` (${t.prize})` : ''}`).join(', '),
          '',
        ],
      }
    })
  return {
    filename: `ohrr-raffle-${today()}`,
    sheetName: 'Raffle',
    title: `Raffle tickets - ${eventName} - made ${new Date().toLocaleDateString('en-US')}`,
    columns: [
      { header: 'Name', width: 24 },
      { header: 'Phone', width: 16 },
      { header: 'Email', width: 28 },
      { header: 'Tickets', width: 9, kind: 'number' },
      { header: 'Ticket numbers', width: 26 },
      { header: 'Amount', width: 10, kind: 'money' },
      { header: 'Status', width: 10 },
      { header: 'Sold', width: 13 },
      { header: 'Won', width: 30 },
      { header: 'Handed over', width: 13 },
    ],
    rows,
  }
}

const plain = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/·/g, '-')
    .replace(/…/g, '...')

/** One letter page (more when long): the totals, every winner with a box to tick, prizes not drawn yet. */
export async function raffleSummaryPdf(
  totals: RaffleTotals,
  winners: RaffleWinner[],
  prizes: RafflePrize[],
  opts: { orgName: string; eventName: string },
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
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
  doc.text('Raffle tickets - the summary', left, y)
  y += 0.3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(plain(`${opts.eventName} - made ${new Date().toLocaleDateString('en-US')}`), left, y)
  y += 0.35

  const facts: [string, string][] = [
    [String(totals.ticketsSold), 'tickets sold'],
    [money(totals.moneyCents) ?? '$0', 'money taken'],
    [String(totals.toPay), 'still to pay'],
    [String(totals.winners), 'winners drawn'],
    [`${totals.prizesDrawn} of ${totals.prizes}`, 'prizes drawn'],
  ]
  const gap = 0.12
  const w = (right - left - gap * (facts.length - 1)) / facts.length
  facts.forEach(([big, small], k) => {
    const x = left + k * (w + gap)
    doc.setFillColor(235, 244, 250)
    doc.roundedRect(x, y, w, 0.75, 0.08, 0.08, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(big.length > 6 ? 13 : 18)
    doc.text(big, x + w / 2, y + 0.4, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(small, x + w / 2, y + 0.62, { align: 'center' })
  })
  y += 1.15

  const cols = { ticket: left, name: left + 1.0, phone: left + 3.2, prize: left + 4.7, box: right }
  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text('TICKET', cols.ticket, y)
    doc.text('WINNER', cols.name, y)
    doc.text('PHONE', cols.phone, y)
    doc.text('PRIZE', cols.prize, y)
    doc.text('HANDED OVER', cols.box, y, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    y += 0.2
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Winners', left, y)
  y += 0.08
  doc.setLineWidth(0.015)
  doc.line(left, y, right, y)
  y += 0.25
  header()
  if (winners.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text('No winners drawn yet.', left, y)
    y += 0.3
  }
  winners.forEach((win, n) => {
    if (y + 0.4 > bottom) {
      page()
      header()
    }
    if (n % 2 === 1) {
      doc.setFillColor(247, 248, 250)
      doc.rect(left - 0.05, y - 0.17, right - left + 0.1, 0.3, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(ticketLabel(win.no), cols.ticket, y)
    doc.text(doc.splitTextToSize(plain(win.name) || '-', 2.1)[0], cols.name, y)
    doc.text(doc.splitTextToSize(plain(win.phone) || '-', 1.4)[0], cols.phone, y)
    doc.text(doc.splitTextToSize(plain(win.prize) || '-', 1.5)[0], cols.prize, y)
    doc.setLineWidth(0.012)
    doc.rect(right - 0.2, y - 0.14, 0.2, 0.2)
    y += 0.3
  })

  const open = prizes.filter((p) => p.status !== 'drawn')
  if (open.length) {
    y += 0.2
    if (y + 0.8 > bottom) page()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Prizes not drawn yet', left, y)
    y += 0.08
    doc.line(left, y, right, y)
    y += 0.25
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    for (const p of open) {
      if (y + 0.3 > bottom) page()
      doc.text(doc.splitTextToSize(plain(p.title), right - left)[0], left, y)
      y += 0.24
    }
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(plain(`${opts.orgName || 'Ohio House Rabbit Rescue'} - raffle, ${opts.eventName}`), left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return doc.output('blob')
}
