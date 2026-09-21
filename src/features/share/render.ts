// Paints a share card onto a canvas: brand background (or the rabbit's photo
// with a dark gradient), OHRR mark, kicker, big headline, subline, and a
// footer with the site address and a QR code. 1080×1080 for feeds, 1080×1920
// for stories. Pure canvas — nothing to install, works on every phone.
import QRCode from 'qrcode'
import type { CardData, CardFormat } from './templates'

export const BRAND_BLUE = '#0669ac'
export const BRAND_BLUE_DARK = '#04507f'
export const BRAND_ORANGE = '#eb891c'

export interface RenderOptions {
  /** URL of the OHRR mark (same-origin), e.g. '/ohrr-mark.png' */
  logoUrl: string
  fontDisplay?: string
  fontBody?: string
}

const SIZES: Record<CardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function ensureFonts(display: string, body: string) {
  try {
    await Promise.all([
      document.fonts.load(`900 80px "${display}"`),
      document.fonts.load(`800 40px "${display}"`),
      document.fonts.load(`600 36px "${body}"`),
    ])
  } catch {
    /* fall back to whatever the browser has */
  }
}

/** Word-wrap a string to `maxWidth`; returns the lines. */
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

/** Largest font size (px) at which `text` fits in `maxLines` lines of `maxWidth`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, maxWidth: number, maxLines: number, from: number, to: number): number {
  for (let size = from; size >= to; size -= 4) {
    ctx.font = `${weight} ${size}px "${family}"`
    if (wrap(ctx, text, maxWidth).length <= maxLines) return size
  }
  return to
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

/** Cover-fit an image into a box. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export async function renderCard(canvas: HTMLCanvasElement, card: CardData, format: CardFormat, opts: RenderOptions): Promise<void> {
  const { w, h } = SIZES[format]
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  const display = opts.fontDisplay ?? 'Nunito'
  const body = opts.fontBody ?? 'Open Sans'
  await ensureFonts(display, body)
  const accent = card.accent === 'orange' ? BRAND_ORANGE : BRAND_BLUE
  const pad = 72
  const story = format === 'story'

  const [photo, logo] = await Promise.all([card.photo ? loadImage(card.photo) : Promise.resolve(null), loadImage(opts.logoUrl)])

  // ---- background
  if (photo) {
    // photo on top, text panel below (square) / photo fills, gradient at the bottom (story)
    if (story) {
      drawCover(ctx, photo, 0, 0, w, h)
      const g = ctx.createLinearGradient(0, h * 0.35, 0, h)
      g.addColorStop(0, 'rgba(4,80,127,0)')
      g.addColorStop(0.45, 'rgba(4,80,127,0.85)')
      g.addColorStop(1, 'rgba(4,80,127,0.97)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    } else {
      ctx.fillStyle = BRAND_BLUE_DARK
      ctx.fillRect(0, 0, w, h)
      const photoH = Math.round(h * 0.56)
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, photoH)
      ctx.clip()
      drawCover(ctx, photo, 0, 0, w, photoH)
      ctx.restore()
      const g = ctx.createLinearGradient(0, photoH - 120, 0, photoH)
      g.addColorStop(0, 'rgba(4,80,127,0)')
      g.addColorStop(1, BRAND_BLUE_DARK)
      ctx.fillStyle = g
      ctx.fillRect(0, photoH - 120, w, 121)
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, BRAND_BLUE)
    g.addColorStop(1, BRAND_BLUE_DARK)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    // soft circles for a little life
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.beginPath()
    ctx.arc(w * 0.85, h * 0.12, w * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(w * 0.1, h * 0.9, w * 0.26, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---- header: mark + wordmark
  const markSize = 84
  if (logo) {
    ctx.save()
    roundRect(ctx, pad, pad, markSize, markSize, 20)
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.clip()
    ctx.drawImage(logo, pad + 8, pad + 8, markSize - 16, markSize - 16)
    ctx.restore()
  }
  ctx.fillStyle = 'white'
  ctx.font = `800 34px "${display}"`
  ctx.textBaseline = 'middle'
  ctx.fillText('Ohio House Rabbit Rescue', pad + markSize + 24, pad + markSize / 2)

  // ---- text block anchored to the bottom
  const maxWidth = w - pad * 2
  const footerH = 220
  let y = h - footerH

  // subline (measure first so headline sits above it)
  let subLines: string[] = []
  const subSize = story ? 40 : 36
  if (card.subline) {
    ctx.font = `600 ${subSize}px "${body}"`
    subLines = wrap(ctx, card.subline, maxWidth).slice(0, 4)
  }
  const subBlockH = subLines.length * (subSize * 1.3)

  const headSize = fitFont(ctx, card.headline, display, 900, maxWidth, story ? 4 : 3, story ? 120 : 104, 56)
  ctx.font = `900 ${headSize}px "${display}"`
  const headLines = wrap(ctx, card.headline, maxWidth)
  const headBlockH = headLines.length * (headSize * 1.08)

  const kickerH = 56
  const gap = 24
  const top = y - subBlockH - (subLines.length ? gap : 0) - headBlockH - gap - kickerH

  // kicker pill
  ctx.font = `800 26px "${display}"`
  const kickerW = ctx.measureText(card.kicker).width + 40
  roundRect(ctx, pad, top, kickerW, 48, 24)
  ctx.fillStyle = accent
  ctx.fill()
  ctx.fillStyle = 'white'
  ctx.textBaseline = 'middle'
  ctx.fillText(card.kicker, pad + 20, top + 25)

  // headline
  ctx.textBaseline = 'alphabetic'
  ctx.font = `900 ${headSize}px "${display}"`
  ctx.fillStyle = 'white'
  let hy = top + kickerH + gap + headSize
  for (const line of headLines) {
    ctx.fillText(line, pad, hy)
    hy += headSize * 1.08
  }

  // subline
  if (subLines.length) {
    ctx.font = `600 ${subSize}px "${body}"`
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    let sy = hy - headSize * 1.08 + gap + subSize
    for (const line of subLines) {
      ctx.fillText(line, pad, sy)
      sy += subSize * 1.3
    }
  }

  // ---- footer: divider, url, QR
  y = h - footerH + 40
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(pad, y, maxWidth, 2)
  const qrSize = 140
  try {
    const qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, card.url, { margin: 1, width: qrSize, color: { dark: '#04507f', light: '#ffffff' } })
    roundRect(ctx, w - pad - qrSize - 12, y + 24, qrSize + 24, qrSize + 24, 18)
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.drawImage(qr, w - pad - qrSize, y + 36, qrSize, qrSize)
  } catch {
    /* no QR — the URL is still printed */
  }
  ctx.fillStyle = 'white'
  ctx.font = `800 34px "${display}"`
  ctx.textBaseline = 'middle'
  ctx.fillText(card.footer, pad, y + 70)
  ctx.font = `600 26px "${body}"`
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText('Scan or tap the link in our bio', pad, y + 116)
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image'))), 'image/png'))
}
