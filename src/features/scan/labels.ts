// Item labels for a label printer: a QR code (opens the item), a Code 128
// barcode (the app's scanner reads it), the number in big type (DON-00042 or a
// SKU like HAY-101-001), the item's name and who gave it — or, for a Hop Shop
// price label, the price. Painted on a canvas at the label's exact size, so the same
// picture prints from a phone (the printer's app or AirPrint), from a laptop
// (any label printer driver) or as a PDF with one label per page. Tall labels
// (3 in and up) get the photo too.
//
// A Silent Auction item can print as a bid-sheet label instead (update 44):
// "SILENT AUCTION" across the top, a big QR ("Scan to buy it now — pay at the
// auction table"), the name, donor, value, starting bid, raise and the Buy it
// now price. Rows that don't fit a small label are left out, least needed first.
//
// The website's src/lib/labels.ts is a copy — keep the two in sync.
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { loadImage, ensureFonts } from '../share/canvas'
import { tagUrl } from './codes'

export interface LabelSize {
  key: string
  label: string
  wIn: number
  hIn: number
}

/** Common thermal label sizes. Widths from 1½ to 4 inches; custom is allowed. */
export const LABEL_SIZES: LabelSize[] = [
  { key: '2.25x1.25', label: '2¼ × 1¼ in (57 × 32 mm)', wIn: 2.25, hIn: 1.25 },
  { key: '2x1', label: '2 × 1 in (51 × 25 mm)', wIn: 2, hIn: 1 },
  { key: '62x29', label: '62 × 29 mm (Brother DK roll)', wIn: 62 / 25.4, hIn: 29 / 25.4 },
  { key: '3x2', label: '3 × 2 in (76 × 51 mm)', wIn: 3, hIn: 2 },
  { key: '4x2', label: '4 × 2 in (102 × 51 mm)', wIn: 4, hIn: 2 },
  { key: '4x3', label: '4 × 3 in (102 × 76 mm)', wIn: 4, hIn: 3 },
  { key: '4x6', label: '4 × 6 in shipping label, with the photo', wIn: 4, hIn: 6 },
]
export const DEFAULT_LABEL_KEY = '2.25x1.25'
export const LABEL_DPI = 300

const SIZE_KEY = 'ohrr.labels.size'

/** The size this device prints (the printer's roll), remembered on the device. */
export function loadLabelSize(): LabelSize {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as LabelSize
      if (s && s.wIn > 0.5 && s.hIn > 0.5 && s.wIn <= 8.5 && s.hIn <= 11) return s
    }
  } catch {
    /* private mode */
  }
  return LABEL_SIZES.find((s) => s.key === DEFAULT_LABEL_KEY)!
}

export function saveLabelSize(s: LabelSize): void {
  try {
    localStorage.setItem(SIZE_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}

/** The rescue's label size (app_settings row), shared by every phone and computer. */
export const LABEL_SIZE_SETTING = 'label_size'

/** A stored size, checked — null when missing or out of range. */
export function labelSizeFrom(v: unknown): LabelSize | null {
  const s = v as Partial<LabelSize> | null
  if (!s || typeof s.wIn !== 'number' || typeof s.hIn !== 'number') return null
  if (!(s.wIn >= 0.5 && s.hIn >= 0.5 && s.wIn <= 8.5 && s.hIn <= 11)) return null
  return LABEL_SIZES.find((p) => p.wIn === s.wIn && p.hIn === s.hIn) ?? customLabelSize(s.wIn, s.hIn)
}

export function customLabelSize(wIn: number, hIn: number): LabelSize {
  const w = Math.round(wIn * 100) / 100
  const h = Math.round(hIn * 100) / 100
  return { key: `custom:${w}x${h}`, label: `${w} × ${h} in (custom)`, wIn: w, hIn: h }
}

export interface LabelItem {
  code: string
  title: string
  donated_by?: string | null
  photo_url?: string | null
  /** "Silent Auction" / "Raffle prize" / … — printed small when given. */
  kindLabel?: string | null
  /** A Hop Shop price label: "OHRR HOP SHOP" on top and the price under the name. */
  shop?: boolean
  /** Printed on a shop label when given (leave out for a label without a price). */
  price_cents?: number | null
  /** A Silent Auction bid-sheet label: the prices, and what the QR offers. */
  auction?: AuctionLabel | null
}

export interface AuctionLabel {
  value_cents?: number | null
  starting_bid_cents?: number | null
  increment_cents?: number | null
  buy_now_cents?: number | null
  /** Buy it now is paid at the auction table (update 44). */
  buy_now_at_table?: boolean
  /** Bids can be placed online too. */
  online_bidding?: boolean
}

export const priceText = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** A photo from storage, loaded so the canvas can still be exported (CORS). */
function loadPhoto(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Greedy word wrap; a word wider than the line stays on its own line. */
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (!line || ctx.measureText(test).width <= maxWidth) line = test
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Cut a line so `line…` fits. */
function ellipsize(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string {
  if (ctx.measureText(line).width <= maxWidth) return line
  let s = line
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

/**
 * Lay the text out in at most `maxLines` lines, shrinking the type (down to
 * 55% of `basePx`) before cutting anything. Sets ctx.font to the size used.
 */
function fitBlock(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number, basePx: number, font: (px: number) => string): { lines: string[]; px: number } {
  let px = basePx
  while (px >= basePx * 0.55) {
    ctx.font = font(px)
    const lines = wrapLines(ctx, text, maxWidth)
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { lines, px }
    px = Math.max(Math.floor(px * 0.92), px - 1)
  }
  px = Math.round(basePx * 0.55)
  ctx.font = font(px)
  const all = wrapLines(ctx, text, maxWidth)
  const lines = all.slice(0, maxLines).map((l, i) => (i === maxLines - 1 && all.length > maxLines ? ellipsize(ctx, `${l} ${all.slice(maxLines).join(' ')}`, maxWidth) : ellipsize(ctx, l, maxWidth)))
  return { lines, px }
}

function barcodeImage(code: string, heightPx: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  JsBarcode(c, code, {
    format: 'CODE128',
    displayValue: false,
    margin: 0,
    width: 3,
    height: Math.max(20, Math.round(heightPx)),
    background: '#ffffff',
    lineColor: '#000000',
  })
  return c
}

/**
 * Paint one label. The canvas becomes exactly wIn×hIn inches at `dpi`.
 * Everything scales with the label, so a 1-inch and a 6-inch label both read
 * well; names shrink to fit before they are ever cut.
 */
export async function renderLabel(canvas: HTMLCanvasElement, item: LabelItem, size: LabelSize, dpi = LABEL_DPI): Promise<void> {
  const W = Math.round(size.wIn * dpi)
  const H = Math.round(size.hIn * dpi)
  if (item.auction) return renderAuctionLabel(canvas, item, item.auction, size, dpi)
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  await ensureFonts(['800 40px "Nunito"', '900 80px "Nunito"', '600 40px "Open Sans"'])

  const m = Math.round(0.07 * dpi) // margin
  const photo = size.hIn >= 3 && item.photo_url ? await loadPhoto(item.photo_url) : null
  let top = m

  // Tall labels: the photo across the top (about 45% of the height).
  if (photo) {
    const boxH = Math.round(H * 0.45)
    const scale = Math.min((W - 2 * m) / photo.width, boxH / photo.height)
    const dw = photo.width * scale
    const dh = photo.height * scale
    ctx.drawImage(photo, (W - dw) / 2, top + (boxH - dh) / 2, dw, dh)
    top += boxH + m
  }

  // Sizes scale with the space left, but never past what the width can carry.
  const bodyH = H - top - m
  const unit = Math.min(bodyH, W * 0.7)
  const barH = Math.round(Math.max(0.22 * dpi, unit * 0.2))
  const codeSize = Math.round(Math.min(Math.max(0.16 * dpi, unit * 0.16), W / 7))
  const qrSide = Math.round(Math.min(unit - barH - codeSize * 1.2 - m, W * 0.42))
  const tw = W - (m + qrSide + m) - m
  const brandSize = Math.round(Math.min(Math.max(0.07 * dpi, unit * 0.075), tw / 15))
  const titleSize = Math.round(Math.min(Math.max(0.11 * dpi, unit * 0.13), tw / 8))
  const smallSize = Math.round(Math.min(Math.max(0.075 * dpi, unit * 0.085), tw / 13))
  const contentH = qrSide + m + barH + Math.round(codeSize * 1.2)
  // Without a photo, sit the whole block in the middle of the label.
  if (!photo) top = Math.max(m, Math.round((H - contentH) / 2))

  // QR on the left.
  const qr = await QRCode.toDataURL(tagUrl(item.code), { errorCorrectionLevel: 'M', margin: 0, width: 600 }).then(loadImage)
  if (qr) ctx.drawImage(qr, m, top, qrSide, qrSide)

  // Text block to the right of the QR: brand, name (shrinks to fit), donor.
  const tx = m + qrSide + m
  let y = top
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#0669ac'
  const brand = fitBlock(ctx, item.shop ? 'OHRR HOP SHOP' : 'OHIO HOUSE RABBIT RESCUE', tw, 1, brandSize, (px) => `800 ${px}px "Nunito"`)
  ctx.fillText(brand.lines[0], tx, y)
  y += Math.round(brand.px * 1.35)

  // The name comes first and stays the biggest text: two lines (three with a
  // photo), shrinking before it is cut. Donor and kind fit in what is left.
  const bottom = top + qrSide + Math.round(m / 2)
  // A shop label keeps room for the price under the name.
  const showPrice = !!item.shop && item.price_cents != null
  const pricePx = Math.round(Math.min(titleSize * 1.15, tw / 4.5))
  const titleRoom = bottom - y - (showPrice ? Math.round(pricePx * 1.1) : 0)
  const titleLines = Math.max(1, Math.min(photo ? 3 : 2, Math.floor(titleRoom / (titleSize * 1.15))))
  ctx.fillStyle = '#0f172a'
  const title = fitBlock(ctx, item.title || 'Untitled', tw, titleLines, titleSize, (px) => `900 ${px}px "Nunito"`)
  for (const l of title.lines) {
    ctx.fillText(l, tx, y)
    y += Math.round(title.px * 1.15)
  }
  if (showPrice) {
    ctx.font = `900 ${pricePx}px "Nunito"`
    ctx.fillText(ellipsize(ctx, priceText(item.price_cents ?? 0), tw), tx, Math.min(y, bottom - pricePx))
    y += Math.round(pricePx * 1.1)
  }

  const meta = (item.shop ? [] : [item.donated_by ? `From ${item.donated_by}` : null, item.kindLabel ?? null]).filter(Boolean) as string[]
  const metaPx = Math.min(smallSize, Math.round(title.px * 0.82))
  ctx.fillStyle = '#334155'
  ctx.font = `600 ${metaPx}px "Open Sans"`
  for (const line of meta) {
    if (y + metaPx > bottom) break
    ctx.fillText(ellipsize(ctx, line, tw), tx, y)
    y += Math.round(metaPx * 1.3)
  }

  // Under it all: the barcode across the label, the code beneath.
  const bandTop = top + qrSide + m
  const bar = barcodeImage(item.code, barH)
  const barW = Math.min(W - 2 * m, Math.round(bar.width * (barH / bar.height)))
  ctx.drawImage(bar, Math.round((W - barW) / 2), bandTop, barW, barH)
  ctx.fillStyle = '#0f172a'
  // The whole number, as big as the width allows (HAY-101-001 is 11 characters).
  let codePx = codeSize
  ctx.font = `900 ${codePx}px "Courier New", monospace`
  while (codePx > 12 && ctx.measureText(item.code).width > W - 2 * m) {
    codePx -= 2
    ctx.font = `900 ${codePx}px "Courier New", monospace`
  }
  ctx.textAlign = 'center'
  ctx.fillText(item.code, W / 2, bandTop + barH + Math.round(codeSize * 0.15))
  ctx.textAlign = 'left'
}

/** "$35" or "$12.50". */
function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${(cents / 100).toLocaleString('en-US')}` : priceText(cents)
}

/** What the QR offers, in one or two short lines. */
export function auctionScanText(a: AuctionLabel): string[] {
  if (a.buy_now_cents != null && a.buy_now_at_table) return ['Scan to buy it now', 'pay at the auction table']
  if (a.online_bidding) return [a.buy_now_cents != null ? 'Scan to bid or buy it now' : 'Scan to bid online']
  return ['Scan for photos and details']
}

/** The bid-sheet label: header band, QR and what it offers, name, donor, prices. */
async function renderAuctionLabel(canvas: HTMLCanvasElement, item: LabelItem, a: AuctionLabel, size: LabelSize, dpi: number): Promise<void> {
  const W = Math.round(size.wIn * dpi)
  const H = Math.round(size.hIn * dpi)
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  await ensureFonts(['800 40px "Nunito"', '900 80px "Nunito"', '600 40px "Open Sans"'])
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const m = Math.round(0.07 * dpi)
  const short = Math.min(W, H)

  // Header: white on black prints crisply on a thermal label.
  const headH = Math.round(Math.min(Math.max(H * 0.13, 0.15 * dpi), 0.34 * dpi))
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, W, headH)
  ctx.fillStyle = '#ffffff'
  let headPx = Math.round(headH * 0.6)
  // The rescue's name too when it fits at three-quarters of the size.
  const long = 'SILENT AUCTION · OHIO HOUSE RABBIT RESCUE'
  ctx.font = `900 ${Math.round(headPx * 0.75)}px "Nunito"`
  const head = ctx.measureText(long).width <= W - 2 * m ? long : 'SILENT AUCTION'
  if (head === long) headPx = Math.round(headPx * 0.75)
  ctx.font = `900 ${headPx}px "Nunito"`
  while (headPx > 10 && ctx.measureText(head).width > W - 2 * m) {
    headPx -= 2
    ctx.font = `900 ${headPx}px "Nunito"`
  }
  ctx.textAlign = 'center'
  ctx.fillText(head, W / 2, Math.round((headH - headPx) / 2))
  ctx.textAlign = 'left'
  let top = headH + m

  // A tall label (4 in and up) gets the photo under the header.
  const photo = size.hIn >= 4 && item.photo_url ? await loadPhoto(item.photo_url) : null
  if (photo) {
    const boxH = Math.round(H * 0.3)
    const scale = Math.min((W - 2 * m) / photo.width, boxH / photo.height)
    const dw = photo.width * scale
    const dh = photo.height * scale
    ctx.drawImage(photo, (W - dw) / 2, top + (boxH - dh) / 2, dw, dh)
    top += boxH + m
  }

  // QR on the left with what it offers under it — or, on a tall label, the QR
  // centred on top and the words full width below it.
  const stack = H >= W * 0.9
  const bodyH = H - top - m
  // A label under about 1 in of body has no room for the words; the QR still works.
  const scanLines = auctionScanText(a).slice(0, stack || bodyH >= 1.2 * dpi ? 2 : bodyH >= 0.8 * dpi ? 1 : 0)
  const footPx = Math.round(Math.min(Math.max(short * 0.065, 0.085 * dpi), 0.17 * dpi))
  const footH = Math.round(footPx * 1.2 * scanLines.length)
  const qrSide = stack
    ? Math.round(Math.min(W * 0.55, bodyH * 0.45))
    : Math.max(Math.round(0.4 * dpi), Math.round(Math.min(bodyH - footH - Math.round(m / 2), W * 0.42)))
  const qx = stack ? Math.round((W - qrSide) / 2) : m
  const qr = await QRCode.toDataURL(tagUrl(item.code), { errorCorrectionLevel: 'M', margin: 0, width: 600 }).then(loadImage)
  if (qr) ctx.drawImage(qr, qx, top, qrSide, qrSide)
  ctx.fillStyle = '#0f172a'
  ctx.textAlign = 'center'
  let fy = top + qrSide + Math.round(m / 2)
  scanLines.forEach((line, i) => {
    const font = (px: number) => (i === 0 ? `900 ${px}px "Nunito"` : `600 ${px}px "Open Sans"`)
    let px = footPx
    ctx.font = font(px)
    while (px > 10 && ctx.measureText(line).width > (stack ? W - 2 * m : qrSide + m)) {
      px -= 1
      ctx.font = font(px)
    }
    ctx.fillText(line, qx + qrSide / 2, fy)
    fy += Math.round(footPx * 1.2)
  })
  ctx.textAlign = 'left'

  // The text column: name, donor, then the prices; the number at the bottom.
  const tx = stack ? m : m + qrSide + m
  const tw = W - tx - m
  if (stack) top = fy + m
  const bottom = H - m
  const unit = Math.min(stack ? bottom - top : bodyH, W * 0.6)
  let titlePx = Math.round(Math.min(Math.max(0.11 * dpi, unit * 0.13), tw / 7))
  let rowPx = Math.round(Math.min(Math.max(0.08 * dpi, unit * 0.085), tw / 11))
  const codePx = Math.round(Math.max(0.07 * dpi, rowPx * 0.8))

  type Row = { label: string; value: string; strong?: boolean }
  let rows: Row[] = [
    a.value_cents != null ? { label: 'Value', value: dollars(a.value_cents) } : null,
    a.starting_bid_cents != null ? { label: 'Starting bid', value: dollars(a.starting_bid_cents) } : null,
    a.increment_cents != null ? { label: 'Raise by', value: dollars(a.increment_cents) } : null,
    a.buy_now_cents != null ? { label: 'Buy it now', value: dollars(a.buy_now_cents), strong: true } : null,
  ].filter(Boolean) as Row[]
  let titleLines = photo || stack ? 3 : 2
  let donor = !!item.donated_by
  const rowH = (r: Row) => Math.round((r.strong ? rowPx * 1.3 : rowPx) * 1.3)
  const need = () => titleLines * titlePx * 1.12 + (donor ? rowPx * 1.35 : 0) + rows.reduce((n, r) => n + rowH(r), 0) + codePx * 1.3
  const room = bottom - top
  // Leave out what's least needed until it fits: donor, value, raise, title lines, then smaller type.
  for (let guard = 0; guard < 30 && need() > room; guard++) {
    if (donor) donor = false
    else if (rows.some((r) => r.label === 'Value')) rows = rows.filter((r) => r.label !== 'Value')
    else if (rows.some((r) => r.label === 'Raise by')) rows = rows.filter((r) => r.label !== 'Raise by')
    else if (titleLines > 1) titleLines--
    else {
      titlePx = Math.max(12, Math.round(titlePx * 0.9))
      rowPx = Math.max(10, Math.round(rowPx * 0.9))
    }
  }

  let y = top
  ctx.fillStyle = '#0f172a'
  const title = fitBlock(ctx, item.title || 'Untitled', tw, titleLines, titlePx, (px) => `900 ${px}px "Nunito"`)
  for (const l of title.lines) {
    ctx.fillText(l, tx, y)
    y += Math.round(title.px * 1.12)
  }
  if (donor && item.donated_by) {
    ctx.fillStyle = '#334155'
    ctx.font = `600 ${Math.round(rowPx * 0.9)}px "Open Sans"`
    ctx.fillText(ellipsize(ctx, `Donated by ${item.donated_by}`, tw), tx, y + Math.round(rowPx * 0.1))
    y += Math.round(rowPx * 1.35)
  }

  // Prices sit at the bottom of the column, the Buy it now price last and biggest.
  const rowsH = rows.reduce((n, r) => n + rowH(r), 0)
  y = Math.max(y + Math.round(rowPx * 0.2), bottom - Math.round(codePx * 1.3) - rowsH)
  for (const r of rows) {
    const px = r.strong ? Math.round(rowPx * 1.3) : rowPx
    if (r.strong) {
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(tx, y - Math.round(px * 0.12), tw, Math.max(2, Math.round(dpi / 150)))
    }
    ctx.fillStyle = r.strong ? '#0f172a' : '#334155'
    ctx.font = r.strong ? `900 ${px}px "Nunito"` : `600 ${px}px "Open Sans"`
    ctx.fillText(r.strong ? r.label.toUpperCase() : r.label, tx, y + Math.round(px * 0.1))
    ctx.fillStyle = '#0f172a'
    ctx.font = `900 ${px}px "Nunito"`
    ctx.textAlign = 'right'
    ctx.fillText(r.value, tx + tw, y + Math.round(px * 0.1))
    ctx.textAlign = 'left'
    y += rowH(r)
  }

  // The item's number, small, bottom right (staff find it on the desk by it).
  ctx.fillStyle = '#334155'
  ctx.font = `700 ${codePx}px "Courier New", monospace`
  ctx.textAlign = 'right'
  ctx.fillText(item.code, W - m, bottom - codePx)
  ctx.textAlign = 'left'
}

/** One label as a PNG data URL (for previews and the print page). */
export async function labelDataUrl(item: LabelItem, size: LabelSize, dpi = LABEL_DPI): Promise<string> {
  const c = document.createElement('canvas')
  await renderLabel(c, item, size, dpi)
  return c.toDataURL('image/png')
}

/** All the labels as one PDF, one label per page at the label's size. */
export async function labelsPdf(items: LabelItem[], size: LabelSize): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const orientation = size.wIn >= size.hIn ? 'landscape' : 'portrait'
  const doc = new jsPDF({ unit: 'in', format: [size.wIn, size.hIn], orientation })
  for (let i = 0; i < items.length; i++) {
    if (i > 0) doc.addPage([size.wIn, size.hIn], orientation)
    const png = await labelDataUrl(items[i], size, 203)
    doc.addImage(png, 'PNG', 0, 0, size.wIn, size.hIn)
  }
  return doc.output('blob')
}
