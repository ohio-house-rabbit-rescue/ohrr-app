// Today at the till as files: the day's totals and what sold, as a PDF to
// print or send from the phone (to check against the cash box and the card
// reader at closing) and as a spreadsheet.
import type { SheetSpec } from '../../lib/inventoryExport'
import { money } from './local'
import type { CounterDay } from './sales'

const plain = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')

/** "Sunday, October 25, 2026" from a yyyy-mm-dd day. */
export const dayWords = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function daySheet(d: CounterDay, day: string): SheetSpec {
  return {
    filename: `ohrr-till-${day}`,
    sheetName: 'Till',
    title: `Today at the till - ${dayWords(day)}`,
    columns: [
      { header: 'Item', width: 36 },
      { header: 'How many', width: 10, kind: 'number' },
      { header: 'Sold for', width: 12, kind: 'money' },
    ],
    rows: d.items.map((i) => ({ photos: [], cells: [i.name, i.qty, i.cents] })),
  }
}

/** One letter page (more when a lot sold): the totals, then every item sold. */
export async function dayPdf(d: CounterDay, day: string, orgName: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' })
  const left = 0.7
  const right = 8.5 - 0.7
  const bottom = 10.2
  let y = 0.85
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(6, 105, 172)
  doc.text(plain(orgName).toUpperCase(), left, y)
  doc.setTextColor(20, 20, 20)
  y += 0.42
  doc.setFontSize(22)
  doc.text('Today at the till', left, y)
  y += 0.28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(plain(dayWords(day)), left, y)
  y += 0.35

  const facts: [string, string][] = [
    [money(d.cash_cents), 'cash'],
    [money(d.card_cents), 'card'],
    [String(d.sales), d.sales === 1 ? 'sale' : 'sales'],
    [money(d.cash_cents + d.card_cents + d.other_cents), 'total'],
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
  y += 1.2

  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text('ITEM', left, y)
    doc.text('HOW MANY', right - 1.3, y, { align: 'right' })
    doc.text('SOLD FOR', right, y, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    y += 0.22
  }
  if (d.items.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(12)
    doc.text('Nothing sold on this day.', left, y)
  } else {
    header()
    d.items.forEach((i, n) => {
      if (y + 0.3 > bottom) {
        doc.addPage('letter', 'portrait')
        y = 0.85
        header()
      }
      if (n % 2 === 1) {
        doc.setFillColor(247, 248, 250)
        doc.rect(left - 0.05, y - 0.17, right - left + 0.1, 0.26, 'F')
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(doc.splitTextToSize(plain(i.name), 4.6)[0], left, y)
      doc.text(String(i.qty), right - 1.3, y, { align: 'right' })
      doc.text(money(i.cents), right, y, { align: 'right' })
      y += 0.26
    })
  }

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(plain(`${orgName} - till, ${day}`), left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return doc.output('blob')
}
