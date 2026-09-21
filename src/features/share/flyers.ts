// Letter-size QR flyers, painted on a canvas so a phone can save or share
// them as an image (print from Photos, hand to whoever has the printer) —
// no PDF library, nothing to install. Same four flyers as the website's
// Staff → Flyers; every one points at a UTM-tagged page so the analytics
// show which doors people come through.
import QRCode from 'qrcode'
import { ohrr } from '../../data/ohrr'
import { BRAND_BLUE, BRAND_ORANGE } from './render'
import { SHARE_SITE_SHORT, utm } from './templates'

export interface Flyer {
  id: string
  audience: string
  kicker: string
  headline: string
  lines: string[]
  cta: string
  path: string
  campaign: string
  accent: 'blue' | 'orange'
}

export const FLYERS: Flyer[] = [
  {
    id: 'app',
    audience: 'Rabbit owners — Hop Shop counter, vet clinics',
    kicker: 'FOR RABBIT OWNERS',
    headline: 'Rabbit questions? OHRR in your pocket.',
    lines: ['“My bunny is…” answers from OHRR, day or night', 'Reminders for nails, hay and RHDV2 boosters — on your phone', 'Rabbit-savvy vets around Central Ohio', 'Nail-trim clinics and bonding dates, booked online'],
    cta: 'Scan to open',
    path: '/app',
    campaign: 'flyer-owners',
    accent: 'blue',
  },
  {
    id: 'volunteer',
    audience: 'Students & young adults — campus boards, coffee shops',
    kicker: 'AN HOUR A MONTH, OR A FEW WEEKS',
    headline: 'Sit with the bunnies. Or foster one.',
    lines: ['Bunny socialization: one-hour shifts, booked online, from age 6', 'Foster: a few weeks with a rabbit in your home, OHRR behind you', 'Good with Instagram or TikTok? OHRR needs you too', 'No experience needed'],
    cta: 'Scan to sign up',
    path: '/volunteer',
    campaign: 'flyer-volunteer',
    accent: 'orange',
  },
  {
    id: 'easter',
    audience: 'Families — pet stores, libraries, schools (February–April)',
    kicker: 'BEFORE YOU BUY A BUNNY',
    headline: 'A rabbit is a 10-year pet.',
    lines: ['Indoors, spayed or neutered, a vet who knows rabbits, a 4′ × 4′ space', 'Prey animals: fragile, easily scared — adults own the care', 'Every spring, rescues fill with bunnies bought in March', 'Thinking about it? Read “Is a rabbit right for us?” first'],
    cta: 'Scan to read',
    path: '/info/is-a-rabbit-right-for-us',
    campaign: 'flyer-easter',
    accent: 'orange',
  },
  {
    id: 'adopt',
    audience: 'Everyone — community boards',
    kicker: 'ADOPTIONS BY APPOINTMENT',
    headline: 'Meet the rabbits waiting for a home.',
    lines: ['Spayed or neutered and vaccinated before adoption', 'Bonded pairs, seniors and shy rabbits who need a patient family', 'Saturdays and Sundays at the Adoption Center, Columbus', 'Already have a bunny? We host bonding dates'],
    cta: 'Scan to see who is waiting',
    path: '/adopt',
    campaign: 'flyer-adopt',
    accent: 'blue',
  },
]

export function flyerLink(f: Flyer): string {
  return utm(f.path, f.campaign, 'print')
}

// US Letter at 200 dpi — sharp on paper, ~1 MB as PNG, fine to share.
export const FLYER_W = 1700
export const FLYER_H = 2200

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function renderFlyer(canvas: HTMLCanvasElement, f: Flyer, logoUrl = '/ohrr-mark.png'): Promise<void> {
  canvas.width = FLYER_W
  canvas.height = FLYER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  const display = 'Nunito'
  const body = 'Open Sans'
  try {
    await Promise.all([document.fonts.load(`900 120px "${display}"`), document.fonts.load(`800 48px "${display}"`), document.fonts.load(`600 44px "${body}"`)])
  } catch {
    /* system fonts */
  }
  const accent = f.accent === 'orange' ? BRAND_ORANGE : BRAND_BLUE
  const [logo, qr] = await Promise.all([loadImage(logoUrl), QRCode.toDataURL(flyerLink(f), { errorCorrectionLevel: 'M', margin: 1, width: 600 }).then(loadImage)])

  // page + border
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, FLYER_W, FLYER_H)
  ctx.lineWidth = 28
  ctx.strokeStyle = accent
  roundRect(ctx, 14, 14, FLYER_W - 28, FLYER_H - 28, 48)
  ctx.stroke()

  const pad = 130
  const inner = FLYER_W - pad * 2
  let y = pad

  // masthead
  if (logo) ctx.drawImage(logo, pad, y, 120, 120)
  ctx.fillStyle = BRAND_BLUE
  ctx.font = `800 54px "${display}"`
  ctx.textBaseline = 'middle'
  ctx.fillText(ohrr.name, pad + 150, y + 60)
  ctx.textBaseline = 'alphabetic'
  y += 120 + 110

  // kicker pill
  ctx.font = `800 40px "${display}"`
  const kw = ctx.measureText(f.kicker).width + 80
  ctx.fillStyle = accent
  roundRect(ctx, pad, y, kw, 76, 38)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(f.kicker, pad + 40, y + 40)
  ctx.textBaseline = 'alphabetic'
  y += 76 + 70

  // headline — largest size that fits in three lines
  ctx.fillStyle = '#0f172a'
  let size = 150
  let lines: string[] = []
  for (; size >= 90; size -= 6) {
    ctx.font = `900 ${size}px "${display}"`
    lines = wrap(ctx, f.headline, inner)
    if (lines.length <= 3) break
  }
  for (const l of lines) {
    y += size
    ctx.fillText(l, pad, y)
  }
  y += 90

  // bullet lines — shrink until they sit above the footer
  const footerTop = FLYER_H - pad - 520 - 40
  let bsize = 58
  let bullets: string[][] = []
  for (; bsize >= 38; bsize -= 4) {
    ctx.font = `600 ${bsize}px "${body}"`
    bullets = f.lines.map((l) => wrap(ctx, l, inner - 80))
    const needed = bullets.reduce((n, ws) => n + ws.length * (bsize + 14) + 44, 0)
    if (y + needed <= footerTop) break
  }
  ctx.font = `600 ${bsize}px "${body}"`
  for (const wrapped of bullets) {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(pad + 18, y + bsize * 0.62, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#334155'
    for (const w of wrapped) {
      y += bsize + 14
      ctx.fillText(w, pad + 80, y)
    }
    y += 44
  }

  // footer: CTA + address left, QR right
  const qrSize = 520
  const qrX = FLYER_W - pad - qrSize
  const qrY = FLYER_H - pad - qrSize
  if (qr) ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)
  const textW = qrX - pad - 60
  let fy = qrY + 80
  ctx.fillStyle = '#0f172a'
  ctx.font = `800 68px "${display}"`
  for (const l of wrap(ctx, f.cta, textW)) {
    ctx.fillText(l, pad, fy)
    fy += 80
  }
  ctx.fillStyle = '#475569'
  fy += 10
  const url = `${SHARE_SITE_SHORT}${f.path === '/' ? '' : f.path}`
  let usize = 46
  for (; usize >= 30; usize -= 2) {
    ctx.font = `600 ${usize}px "${body}"`
    if (ctx.measureText(url).width <= textW) break
  }
  if (ctx.measureText(url).width > textW) {
    // still too long: break after the site name
    const cut = url.indexOf('/')
    ctx.fillText(url.slice(0, cut), pad, fy)
    fy += usize + 8
    ctx.fillText(url.slice(cut), pad, fy)
  } else ctx.fillText(url, pad, fy)
  fy += 90
  ctx.fillStyle = '#64748b'
  ctx.font = `500 40px "${body}"`
  ctx.fillText(ohrr.address, pad, fy)
  fy += 56
  ctx.fillText(ohrr.phone, pad, fy)
}
