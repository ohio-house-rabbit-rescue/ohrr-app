// Donations this month as files: the PDF that used to be the browser's Print
// page (so a phone can send it, not only a computer), and the matching
// spreadsheet. Same content as the old printed page: the totals, where it is
// now, by donor, and every donation.
import type { SheetSpec } from '../../lib/inventoryExport'
import { ohrr } from '../../data/ohrr'
import type { DonationLine } from './api'
import { formatMoney, usDate } from './types'
import { DONATIONS_CSV_HEADERS, donorOf, lineCode, lineLabel, plural, reportTotals, whereNow } from './letters'

/** jsPDF's built-in fonts have no curly quotes or long dashes. */
const plain = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/×/g, 'x')

/** The donations as a spreadsheet (and CSV) with a photo in each row. */
export function donationsSheet(lines: DonationLine[], monthLabel: string, stamp: string): SheetSpec {
  return {
    filename: `ohrr-donations-${stamp}`,
    sheetName: 'Donations',
    title: `Donations received - ${monthLabel} - made ${new Date().toLocaleDateString('en-US')}`,
    columns: DONATIONS_CSV_HEADERS.map((header, i) => ({
      header,
      width: [13, 22, 30, 12, 9, 11, 11, 28, 14][i],
      kind: i === 4 ? ('number' as const) : i === 5 || i === 6 ? ('money' as const) : ('text' as const),
    })),
    rows: lines.map((l) => ({
      photos: l.photo_url ? [l.photo_url] : [],
      cells: [usDate(l.received_on), donorOf(l), l.title ?? '', l.size ?? '', Math.max(1, l.quantity ?? 1), l.value_each_cents, l.value_total_cents, whereNow(l, true), lineCode(l) ?? ''],
    })),
  }
}

/** One letter page or more: the month's totals, where it is now, by donor, then every donation. */
export async function donationsReportPdf(lines: DonationLine[], ordered: DonationLine[], monthLabel: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const totals = reportTotals(lines)
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const left = 0.7
  const right = 8.5 - 0.7
  const bottom = 10.2
  let y = 0.85
  const page = () => {
    doc.addPage('letter', 'portrait')
    y = 0.85
  }
  const need = (h: number) => {
    if (y + h > bottom) page()
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(6, 105, 172)
  doc.text(plain(ohrr.name).toUpperCase(), left, y)
  doc.setTextColor(20, 20, 20)
  y += 0.42
  doc.setFontSize(20)
  doc.text(plain(`Donations received - ${monthLabel}`), left, y)
  y += 0.28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(plain(`Printed ${usDate(new Date().toISOString().slice(0, 10))}`), left, y)
  y += 0.35

  // The totals, in boxes across the page.
  const facts: [string, string][] = [
    [String(totals.items), totals.items === 1 ? 'item' : 'items'],
    [String(totals.pieces), totals.pieces === 1 ? 'piece' : 'pieces'],
    [String(totals.donors), totals.donors === 1 ? 'donor' : 'donors'],
    [formatMoney(totals.value_cents) || '$0', 'value'],
  ]
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
  y += 1.0
  const notes = [totals.notNamed > 0 ? `${plural(totals.notNamed, 'item')} not named` : '', totals.noValue > 0 ? `${totals.noValue} had no value` : ''].filter(Boolean)
  if (notes.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text(plain(notes.join(' - ')), left, y)
    doc.setTextColor(20, 20, 20)
    y += 0.25
  }

  const heading = (text: string) => {
    need(0.9)
    y += 0.15
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(text, left, y)
    y += 0.08
    doc.setLineWidth(0.015)
    doc.line(left, y, right, y)
    y += 0.24
  }

  heading('Where it is now')
  doc.setFontSize(11)
  totals.places.forEach((p) => {
    need(0.3)
    doc.setFont('helvetica', 'normal')
    doc.text(plain(p.label), left, y)
    doc.text(plain(`${p.lines}${p.pieces !== p.lines ? ` (${plural(p.pieces, 'piece')})` : ''}`), right, y, { align: 'right' })
    y += 0.25
  })

  heading('By donor')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  doc.text('NAME', left, y)
  doc.text('ITEMS', right - 1.2, y, { align: 'right' })
  doc.text('VALUE', right, y, { align: 'right' })
  doc.setTextColor(20, 20, 20)
  y += 0.22
  totals.byDonor.forEach((d) => {
    need(0.3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(doc.splitTextToSize(plain(d.name) || 'Not named', 4.4)[0], left, y)
    doc.text(String(d.items), right - 1.2, y, { align: 'right' })
    doc.text(d.value_cents ? formatMoney(d.value_cents) : '-', right, y, { align: 'right' })
    y += 0.25
  })

  heading('Every donation')
  const cols = { date: left, donor: left + 0.85, item: left + 2.15, value: left + 4.55, where: left + 4.7, code: right }
  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(90, 90, 90)
    doc.text('DATE', cols.date, y)
    doc.text('DONOR', cols.donor, y)
    doc.text('ITEM', cols.item, y)
    doc.text('VALUE', cols.value, y, { align: 'right' })
    doc.text('WHERE NOW', cols.where, y)
    doc.text('CODE', cols.code, y, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    y += 0.2
  }
  header()
  ordered.forEach((l, n) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    const donor = doc.splitTextToSize(plain(donorOf(l)) || 'Not named', 1.2).slice(0, 2) as string[]
    const item = doc.splitTextToSize(plain(lineLabel(l)), 2.3).slice(0, 2) as string[]
    const where = doc.splitTextToSize(plain(whereNow(l, true)), 1.3).slice(0, 2) as string[]
    const rows = Math.max(donor.length, item.length, where.length)
    const h = 0.17 * rows + 0.1
    if (y + h > bottom) {
      page()
      header()
    }
    if (n % 2 === 1) {
      doc.setFillColor(247, 248, 250)
      doc.rect(left - 0.05, y - 0.14, right - left + 0.1, h, 'F')
    }
    doc.text(plain(usDate(l.received_on)), cols.date, y)
    doc.text(donor, cols.donor, y)
    doc.text(item, cols.item, y)
    doc.text(plain(formatMoney(l.value_total_cents)) || '-', cols.value, y, { align: 'right' })
    doc.text(where, cols.where, y)
    doc.setFont('courier', 'normal')
    doc.setFontSize(8)
    doc.text(lineCode(l) ?? '', cols.code, y, { align: 'right' })
    y += h
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(plain(`${ohrr.name} - donations, ${monthLabel}`), left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return doc.output('blob')
}
