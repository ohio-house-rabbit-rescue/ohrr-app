// Letters painted onto a US-Letter page image, for the phone app where there
// is no print dialog: the image goes to the share sheet (Print / AirPrint,
// Mail, Files). The website prints the same letters as HTML instead.
//
// One painter for the outreach letter (with a QR code to sign up), the hours
// letters (with the dated list and a signature block) and the certificate.
import QRCode from 'qrcode'
import { BRAND_BLUE, BRAND_ORANGE } from '../share/render'
import { LETTER_H, LETTER_W, ensureFonts, letterPage, loadImage, wrap } from '../share/canvas'
import { fmtHours } from './calls'
import { longDate, type HoursLine } from './letters'

export interface OrgHead {
  name: string
  address: string
  phone: string
  email: string
}

export interface PaintableLetter {
  date: string
  recipient?: string[]
  title?: string
  salutation?: string
  paragraphs: string[]
  table?: { lines: HoursLine[]; total: number }
  closing?: string
  signer?: { name: string; title: string }
  /** Write the signer's name as a signature (a volunteer's self-serve letter). */
  signed?: boolean
  /** "Check this letter at … — code K7Q2-M9XP", above the footer. */
  verify?: string
  qr?: { url: string; caption: string }
  footer: string
  org: OrgHead
}

// The signature on a self-serve letter: the signer's name in a handwriting
// face (Dancing Script, SIL Open Font License, bundled at /fonts so it works
// offline). It is not an image of anyone's real signature.
let sigFont: Promise<string> | null = null
function signatureFont(): Promise<string> {
  sigFont ??= new FontFace('OHRR Signature', 'url(/fonts/dancing-script-600.woff2)', { weight: '600' })
    .load()
    .then((f) => {
      document.fonts.add(f)
      return '"OHRR Signature"'
    })
    .catch(() => 'cursive')
  return sigFont
}

const PAD = 150
const INNER = LETTER_W - PAD * 2

function letterhead(ctx: CanvasRenderingContext2D, org: OrgHead, logo: HTMLImageElement | null): number {
  let y = PAD
  if (logo) ctx.drawImage(logo, PAD, y, 110, 110)
  ctx.fillStyle = BRAND_BLUE
  ctx.font = '900 46px "Nunito"'
  ctx.fillText(org.name, PAD + 135, y + 50)
  ctx.fillStyle = '#475569'
  ctx.font = '500 26px "Open Sans"'
  ctx.fillText([org.address, org.email].filter(Boolean).join(' · '), PAD + 135, y + 92)
  y += 130
  ctx.fillStyle = BRAND_BLUE
  ctx.fillRect(PAD, y, INNER, 6)
  return y + 70
}

function para(ctx: CanvasRenderingContext2D, text: string, y: number, lineH = 44, width = INNER): number {
  for (const l of wrap(ctx, text, width)) {
    ctx.fillText(l, PAD, y)
    y += lineH
  }
  return y
}

export async function paintLetter(canvas: HTMLCanvasElement, d: PaintableLetter, logoUrl = '/ohrr-mark.png'): Promise<void> {
  const ctx = letterPage(canvas)
  await ensureFonts(['900 64px "Nunito"', '800 40px "Nunito"', '500 34px "Open Sans"', '700 34px "Open Sans"'])
  const logo = await loadImage(logoUrl)
  let y = letterhead(ctx, d.org, logo)

  ctx.fillStyle = '#475569'
  ctx.font = '500 30px "Open Sans"'
  ctx.fillText(d.date, PAD, y)
  y += 60

  if (d.recipient?.length) {
    ctx.fillStyle = '#0f172a'
    ctx.font = '500 30px "Open Sans"'
    for (const r of d.recipient) {
      ctx.fillText(r, PAD, y)
      y += 40
    }
    y += 24
  }

  if (d.title) {
    ctx.fillStyle = '#0f172a'
    ctx.font = '900 46px "Nunito"'
    ctx.fillText(d.title, PAD, y)
    y += 64
  }

  ctx.fillStyle = '#0f172a'
  ctx.font = '500 30px "Open Sans"'
  if (d.salutation) {
    ctx.fillText(d.salutation, PAD, y)
    y += 56
  }
  // Leave room for whatever comes after the paragraphs.
  const reserve = (d.table ? 160 : 0) + (d.signer ? 260 : 0) + (d.qr ? 340 : 0) + 90
  for (const p of d.paragraphs) {
    y = para(ctx, p, y, 42)
    y += 18
  }

  if (d.table) {
    y += 10
    const colAct = PAD + 330
    const colHrs = PAD + INNER
    ctx.fillStyle = '#64748b'
    ctx.font = '700 22px "Open Sans"'
    ctx.fillText('DATE', PAD, y)
    ctx.fillText('ACTIVITY', colAct, y)
    ctx.textAlign = 'right'
    ctx.fillText('HOURS', colHrs, y)
    ctx.textAlign = 'left'
    y += 14
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(PAD, y, INNER, 2)
    y += 38
    ctx.font = '500 26px "Open Sans"'
    const sorted = [...d.table.lines].sort((a, b) => a.on_date.localeCompare(b.on_date))
    const room = Math.max(3, Math.floor((LETTER_H - reserve - y) / 40))
    const shown = sorted.length > room ? sorted.slice(0, room - 1) : sorted
    for (const l of shown) {
      ctx.fillStyle = '#0f172a'
      ctx.fillText(longDate(l.on_date), PAD, y)
      ctx.fillText(wrap(ctx, l.activity.replace(/\s*\(volunteer call\)$/i, ''), colHrs - 120 - colAct)[0] ?? '', colAct, y)
      ctx.textAlign = 'right'
      ctx.fillText(fmtHours(l.hours), colHrs, y)
      ctx.textAlign = 'left'
      y += 40
    }
    if (shown.length < sorted.length) {
      ctx.fillStyle = '#64748b'
      ctx.fillText(`… and ${sorted.length - shown.length} more dates (the full list is on file)`, PAD, y)
      y += 40
    }
    ctx.fillStyle = '#cbd5e1'
    ctx.fillRect(PAD, y - 22, INNER, 2)
    y += 14
    ctx.fillStyle = '#0f172a'
    ctx.font = '700 28px "Open Sans"'
    ctx.fillText('Total', PAD, y)
    ctx.textAlign = 'right'
    ctx.fillText(`${fmtHours(d.table.total)} hours`, colHrs, y)
    ctx.textAlign = 'left'
    y += 60
  }

  if (d.qr) {
    const size = 260
    const qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, d.qr.url, { width: size, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
    const top = Math.min(y + 10, LETTER_H - 150 - size - 60)
    ctx.drawImage(qr, PAD, top, size, size)
    ctx.fillStyle = BRAND_ORANGE
    ctx.font = '800 36px "Nunito"'
    ctx.fillText('Scan to sign up', PAD + size + 40, top + 80)
    ctx.fillStyle = '#334155'
    ctx.font = '500 26px "Open Sans"'
    let yy = top + 126
    for (const l of wrap(ctx, d.qr.caption, INNER - size - 40)) {
      ctx.fillText(l, PAD + size + 40, yy)
      yy += 36
    }
    y = top + size + 40
  }

  if (d.closing || d.signer) {
    const sy = Math.max(y + 40, LETTER_H - 420)
    ctx.fillStyle = '#0f172a'
    ctx.font = '500 30px "Open Sans"'
    if (d.closing) ctx.fillText(d.closing, PAD, sy)
    if (d.signer) {
      if (d.signed && d.signer.name) {
        ctx.fillStyle = '#1e3a8a'
        ctx.font = `600 76px ${await signatureFont()}`
        ctx.fillText(d.signer.name, PAD + 10, sy + 96)
      }
      ctx.fillStyle = '#94a3b8'
      ctx.fillRect(PAD, sy + 110, INNER / 2 - 40, 2)
      ctx.fillStyle = '#0f172a'
      ctx.font = '700 28px "Open Sans"'
      // No signer set: the lines stay blank so whoever signs can write them in.
      const under = [d.signer.title, d.org.name].filter(Boolean)
      if (d.signer.name) ctx.fillText(d.signer.name, PAD, sy + 150)
      ctx.fillStyle = '#475569'
      ctx.font = '500 26px "Open Sans"'
      under.forEach((t, i) => ctx.fillText(t, PAD, sy + (d.signer?.name ? 186 : 150) + i * 34))
    }
  }

  ctx.textAlign = 'center'
  if (d.verify) {
    ctx.fillStyle = '#475569'
    ctx.font = '600 24px "Open Sans"'
    ctx.fillText(d.verify, LETTER_W / 2, LETTER_H - 118)
  }
  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 22px "Open Sans"'
  ctx.fillText(d.footer, LETTER_W / 2, LETTER_H - 80)
  ctx.textAlign = 'left'
}

/** A certificate of appreciation — big, centred, made to be framed. */
export async function paintCertificate(
  canvas: HTMLCanvasElement,
  d: {
    name: string
    lines: string[]
    date: string
    signer: { name: string; title: string }
    org: OrgHead
    /** Write the signer's name as a signature (a volunteer's self-serve certificate). */
    signed?: boolean
    /** "Check this certificate at … — code K7Q2-M9XP", at the foot. */
    verify?: string
    /** The line over the name; default CERTIFICATE OF APPRECIATION (e.g. CERTIFICATE OF ACHIEVEMENT). */
    heading?: string
  },
  logoUrl = '/ohrr-mark.png',
): Promise<void> {
  const ctx = letterPage(canvas)
  await ensureFonts(['900 96px "Nunito"', '800 40px "Nunito"', '500 34px "Open Sans"'])
  const logo = await loadImage(logoUrl)
  const cx = LETTER_W / 2
  // A double border.
  ctx.strokeStyle = BRAND_BLUE
  ctx.lineWidth = 14
  ctx.strokeRect(70, 70, LETTER_W - 140, LETTER_H - 140)
  ctx.strokeStyle = BRAND_ORANGE
  ctx.lineWidth = 4
  ctx.strokeRect(110, 110, LETTER_W - 220, LETTER_H - 220)

  let y = 260
  if (logo) ctx.drawImage(logo, cx - 90, y, 180, 180)
  y += 280
  ctx.textAlign = 'center'
  ctx.fillStyle = BRAND_ORANGE
  ctx.font = '800 40px "Nunito"'
  ctx.fillText((d.heading || 'Certificate of appreciation').toUpperCase(), cx, y)
  y += 170
  ctx.fillStyle = '#0f172a'
  let size = 110
  ctx.font = `900 ${size}px "Nunito"`
  while (ctx.measureText(d.name).width > LETTER_W - 400 && size > 60) {
    size -= 6
    ctx.font = `900 ${size}px "Nunito"`
  }
  ctx.fillText(d.name, cx, y)
  y += 110
  ctx.fillStyle = '#334155'
  ctx.font = '500 38px "Open Sans"'
  for (const p of d.lines) {
    for (const l of wrap(ctx, p, LETTER_W - 500)) {
      ctx.fillText(l, cx, y)
      y += 56
    }
    y += 30
  }
  // Signature and date, side by side near the bottom.
  const sy = LETTER_H - 520
  const w = 520
  if (d.signed && d.signer.name) {
    ctx.fillStyle = '#1e3a8a'
    ctx.font = `600 80px ${await signatureFont()}`
    ctx.fillText(d.signer.name, cx - w / 2 - 60, sy - 18)
  }
  ctx.fillStyle = '#94a3b8'
  ctx.fillRect(cx - w - 60, sy, w, 2)
  ctx.fillRect(cx + 60, sy, w, 2)
  ctx.fillStyle = '#0f172a'
  ctx.font = '700 30px "Open Sans"'
  ctx.fillText(d.signer.name || 'Signature', cx - w / 2 - 60, sy + 46)
  ctx.fillText(d.date, cx + 60 + w / 2, sy + 46)
  ctx.fillStyle = '#475569'
  ctx.font = '500 26px "Open Sans"'
  ctx.fillText(d.signer.title ? `${d.signer.title}, ${d.org.name}` : d.org.name, cx - w / 2 - 60, sy + 84)
  ctx.fillText('Date', cx + 60 + w / 2, sy + 84)
  if (d.verify) {
    ctx.fillStyle = '#64748b'
    ctx.font = '600 24px "Open Sans"'
    ctx.fillText(d.verify, cx, LETTER_H - 170)
  }
  ctx.textAlign = 'left'
}
