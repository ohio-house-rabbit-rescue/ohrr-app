// The end of a volunteer call (step 5, "Thank everyone"): who came, their
// hours, who still needs thanking — as a PDF to print or send, and as a
// spreadsheet. The same "I'm done" summary the receiving flow ends with
// (staff audit, 2026-10-27).
import type { SheetSpec } from '../../lib/inventoryExport'
import { fmtClock, fmtDay, fmtHours, fmtShift, whenText, type Call, type Helper, type OrgBits } from './calls'
import type { RosterLine } from './callsApi'

export interface CallTotals {
  signedUp: number
  came: number
  noShow: number
  hours: number
  thanked: number
  toThank: number
}

export function callTotals(roster: RosterLine[], helpers: Helper[]): CallTotals {
  const booked = roster.filter((r) => r.booking_id && r.status !== 'cancelled')
  return {
    signedUp: booked.length,
    came: booked.filter((r) => r.status === 'checked_in').length,
    noShow: booked.filter((r) => r.status === 'no_show').length,
    hours: helpers.reduce((n, h) => n + h.hours_here, 0),
    thanked: helpers.filter((h) => h.thanked_at).length,
    toThank: helpers.filter((h) => !h.thanked_at).length,
  }
}

const plain = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')

const statusWord = (s: string | null) => (s === 'checked_in' ? 'Came' : s === 'no_show' ? "Didn't come" : s === 'cancelled' ? 'Canceled' : 'Signed up')

export function callSheet(call: Call, roster: RosterLine[], helpers: Helper[]): SheetSpec {
  const byEmail = new Map(helpers.map((h) => [h.email.toLowerCase(), h]))
  const rows = roster
    .filter((r) => r.booking_id)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || (a.name ?? '').localeCompare(b.name ?? ''))
    .map((r) => {
      const h = r.email ? byEmail.get(r.email.toLowerCase()) : undefined
      return {
        photos: [],
        cells: [fmtShift(r), r.name ?? '', r.email ?? '', r.phone ?? '', r.area ?? '', statusWord(r.status), h ? h.hours_here : null, h?.thanked_at ? 'Yes' : r.status === 'checked_in' ? 'Not yet' : ''],
      }
    })
  return {
    filename: `ohrr-volunteers-${call.slug || 'call'}-${call.on_date}`,
    sheetName: 'Volunteers',
    title: `${call.title} - ${whenText(call, true)} - made ${new Date().toLocaleDateString('en-US')}`,
    columns: [
      { header: 'Shift', width: 18 },
      { header: 'Name', width: 24 },
      { header: 'Email', width: 28 },
      { header: 'Phone', width: 16 },
      { header: 'Area', width: 20 },
      { header: 'Came?', width: 12 },
      { header: 'Hours here', width: 11, kind: 'number' },
      { header: 'Thanked', width: 10 },
    ],
    rows,
  }
}

/** One letter page (more when long): the call, the totals, every shift with who came. */
export async function callSummaryPdf(call: Call, roster: RosterLine[], helpers: Helper[], org: OrgBits): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const t = callTotals(roster, helpers)
  const byEmail = new Map(helpers.map((h) => [h.email.toLowerCase(), h]))
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
  doc.text(plain(org.name || 'OHIO HOUSE RABBIT RESCUE').toUpperCase(), left, y)
  doc.setTextColor(20, 20, 20)
  y += 0.42
  doc.setFontSize(22)
  doc.text(doc.splitTextToSize(plain(call.title), right - left).slice(0, 2), left, y)
  y += 0.3 * Math.min(2, doc.splitTextToSize(plain(call.title), right - left).length)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text(plain(`${whenText(call, true)}${call.location ? ` - ${call.location}` : ''}`), left, y)
  y += 0.35

  const facts: [string, string][] = [
    [String(t.signedUp), 'signed up'],
    [String(t.came), 'came'],
    [fmtHours(t.hours), t.hours === 1 ? 'hour given' : 'hours given'],
    [String(t.thanked), 'thanked'],
  ]
  if (t.toThank) facts.push([String(t.toThank), 'still to thank'])
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
  y += 1.15

  const cols = { name: left, area: left + 2.6, came: left + 4.6, hours: left + 5.7, thanked: right }
  const header = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(90, 90, 90)
    doc.text('NAME', cols.name, y)
    doc.text('AREA', cols.area, y)
    doc.text('CAME?', cols.came, y)
    doc.text('HOURS', cols.hours, y)
    doc.text('THANKED', cols.thanked, y, { align: 'right' })
    doc.setTextColor(20, 20, 20)
    y += 0.18
  }
  const slots = [...new Map(roster.map((r) => [r.slot_id, r])).values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  for (const s of slots) {
    const people = roster.filter((r) => r.slot_id === s.slot_id && r.booking_id && r.status !== 'cancelled').sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
    if (y + 0.8 > bottom) page()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(`${fmtShift(s)}  -  ${people.filter((p) => p.status === 'checked_in').length} of ${people.length} came`, left, y)
    y += 0.08
    doc.setLineWidth(0.015)
    doc.line(left, y, right, y)
    y += 0.25
    header()
    if (people.length === 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text('Nobody signed up.', left, y)
      y += 0.3
    }
    people.forEach((p, n) => {
      if (y + 0.3 > bottom) {
        page()
        header()
      }
      if (n % 2 === 1) {
        doc.setFillColor(247, 248, 250)
        doc.rect(left - 0.05, y - 0.17, right - left + 0.1, 0.26, 'F')
      }
      const h = p.email ? byEmail.get(p.email.toLowerCase()) : undefined
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(doc.splitTextToSize(plain(p.name) || '-', 2.4)[0], cols.name, y)
      doc.text(doc.splitTextToSize(plain(p.area) || '-', 1.8)[0], cols.area, y)
      doc.text(statusWord(p.status), cols.came, y)
      doc.text(h ? fmtHours(h.hours_here) : '-', cols.hours, y)
      doc.text(h?.thanked_at ? 'Yes' : p.status === 'checked_in' ? 'Not yet' : '-', cols.thanked, y, { align: 'right' })
      y += 0.26
    })
    y += 0.2
  }

  const pages = doc.getNumberOfPages()
  const when = `${fmtDay(call.on_date, true)} ${fmtClock(call.starts_at)}-${fmtClock(call.ends_at)}`
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(plain(`${org.name || 'Ohio House Rabbit Rescue'} - volunteers, ${when}`), left, 10.65)
    doc.text(`Page ${p} of ${pages}`, right, 10.65, { align: 'right' })
  }
  return doc.output('blob')
}
