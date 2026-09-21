// Paints the service-hours letter onto a US-Letter canvas, for the native app
// where window.print() does nothing: the image goes to the share sheet
// (Print / AirPrint, Mail, Files). Same wording as the on-screen letter.
import { ohrr } from '../../data/ohrr'
import { BRAND_BLUE } from '../share/render'
import { LETTER_H, LETTER_W, ensureFonts, letterPage, loadImage, wrap } from '../share/canvas'
import type { HoursLine } from './api'

export interface LetterData {
  name: string
  from: string
  to: string
  lines: HoursLine[]
  total: number
  today: string
  signer?: string
  fmtDate: (iso: string) => string
  fmtHours: (n: number) => string
}

export async function renderLetter(canvas: HTMLCanvasElement, d: LetterData, logoUrl = '/ohrr-mark.png'): Promise<void> {
  const ctx = letterPage(canvas)
  await ensureFonts(['900 64px "Nunito"', '800 40px "Nunito"', '500 34px "Open Sans"', '700 34px "Open Sans"'])
  const logo = await loadImage(logoUrl)
  const pad = 150
  const inner = LETTER_W - pad * 2
  let y = pad

  // letterhead
  if (logo) ctx.drawImage(logo, pad, y, 110, 110)
  ctx.fillStyle = BRAND_BLUE
  ctx.font = '900 46px "Nunito"'
  ctx.fillText('Ohio House Rabbit Rescue, Inc.', pad + 135, y + 50)
  ctx.fillStyle = '#475569'
  ctx.font = '500 26px "Open Sans"'
  ctx.fillText(`${ohrr.address} · ${ohrr.phone} · ${ohrr.email}`, pad + 135, y + 92)
  y += 130
  ctx.fillStyle = BRAND_BLUE
  ctx.fillRect(pad, y, inner, 6)
  y += 70

  ctx.fillStyle = '#475569'
  ctx.font = '500 30px "Open Sans"'
  ctx.fillText(d.today, pad, y)
  y += 80

  ctx.fillStyle = '#0f172a'
  ctx.font = '900 54px "Nunito"'
  ctx.fillText('Verification of volunteer service hours', pad, y)
  y += 70

  ctx.font = '500 34px "Open Sans"'
  const para = `To whom it may concern: this letter confirms that ${d.name} volunteered ${d.fmtHours(d.total)} hours with Ohio House Rabbit Rescue between ${d.fmtDate(d.from)} and ${d.fmtDate(d.to)}, as recorded in our volunteer system.`
  for (const l of wrap(ctx, para, inner)) {
    y += 46
    ctx.fillText(l, pad, y)
  }
  y += 50

  // table
  const colDate = pad
  const colAct = pad + 320
  const colHrs = pad + inner
  ctx.fillStyle = '#64748b'
  ctx.font = '700 24px "Open Sans"'
  ctx.fillText('DATE', colDate, y)
  ctx.fillText('ACTIVITY', colAct, y)
  ctx.textAlign = 'right'
  ctx.fillText('HOURS', colHrs, y)
  ctx.textAlign = 'left'
  y += 14
  ctx.fillStyle = '#cbd5e1'
  ctx.fillRect(pad, y, inner, 2)
  y += 40
  ctx.font = '500 30px "Open Sans"'
  const maxRows = 22
  const rows = d.lines.slice(0, maxRows)
  for (const l of rows) {
    ctx.fillStyle = '#0f172a'
    ctx.fillText(d.fmtDate(l.on_date), colDate, y)
    const act = wrap(ctx, l.activity, colHrs - 140 - colAct)[0] ?? ''
    ctx.fillText(act, colAct, y)
    ctx.textAlign = 'right'
    ctx.fillText(d.fmtHours(l.hours), colHrs, y)
    ctx.textAlign = 'left'
    y += 10
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(pad, y, inner, 1)
    y += 36
  }
  if (d.lines.length > maxRows) {
    ctx.fillStyle = '#64748b'
    ctx.fillText(`… and ${d.lines.length - maxRows} more entries (full list available on request)`, colDate, y)
    y += 46
  }
  ctx.fillStyle = '#0f172a'
  ctx.font = '700 32px "Open Sans"'
  ctx.fillText('Total', colDate, y)
  ctx.textAlign = 'right'
  ctx.fillText(`${d.fmtHours(d.total)} hours`, colHrs, y)
  ctx.textAlign = 'left'
  y += 80

  ctx.font = '500 30px "Open Sans"'
  for (const l of wrap(ctx, `Ohio House Rabbit Rescue is a 501(c)(3) nonprofit rabbit rescue and adoption center in Columbus, Ohio. Please contact us at ${ohrr.email} or ${ohrr.phone} with any questions.`, inner)) {
    y += 42
    ctx.fillText(l, pad, y)
  }

  // signature lines pinned toward the bottom
  const sy = Math.max(y + 160, LETTER_H - 420)
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(pad, sy, inner / 2 - 40, 2)
  ctx.fillRect(pad + inner / 2 + 40, sy, inner / 2 - 40, 2)
  ctx.fillStyle = '#475569'
  ctx.font = '500 26px "Open Sans"'
  ctx.fillText('Signature, Ohio House Rabbit Rescue', pad, sy + 40)
  if (d.signer) ctx.fillText(d.signer, pad, sy + 76)
  ctx.fillText('Printed name and role', pad + inner / 2 + 40, sy + 40)
}
