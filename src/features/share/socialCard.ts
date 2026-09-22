// "Share this" for visitors: a square, OHRR-branded image painted on the phone
// and handed to the share sheet, so a post looks like it came from the rescue
// rather than a screenshot of a web page.
//
// Same painter approach as the flyers and the volunteer-hours card: a canvas,
// the app's own fonts and mark, no service and no cost. One shape covers every
// subject — a rabbit, an event, a Happy Tail, the raffle — because the thing
// that matters is that OHRR's name and the link travel with the picture.
import QRCode from 'qrcode'
import { ensureFonts, loadImage, roundRect, wrap } from './canvas'

export const CARD = 1080

export interface SocialCard {
  /** "Meet Clover", "Midwest BunFest 2026" */
  title: string
  /** One or two lines under the title. */
  subtitle?: string
  /** The small label above the title: "ADOPTABLE RABBIT", "HAPPY TAIL". */
  kicker?: string
  /** A photo to fill the top half — a rabbit, an item, the event. */
  photoUrl?: string
  /** Where the card points people. Printed, and turned into a QR. */
  link: string
  /** A short call to action printed above the link. */
  cta?: string
}

/** Draw `img` to cover a box (like CSS object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

export async function renderSocialCard(canvas: HTMLCanvasElement, card: SocialCard): Promise<void> {
  await ensureFonts(['900 96px "Nunito"', '800 44px "Nunito"', '600 36px "Open Sans"'])
  canvas.width = CARD
  canvas.height = CARD
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This device can’t make the picture.')

  ctx.fillStyle = '#0669ac'
  ctx.fillRect(0, 0, CARD, CARD)

  // Top: the photo, or a brand-blue field when there isn't one.
  const photoH = card.photoUrl ? 560 : 320
  if (card.photoUrl) {
    const img = await loadImage(card.photoUrl)
    if (img) drawCover(ctx, img, 0, 0, CARD, photoH)
    else {
      ctx.fillStyle = '#055287'
      ctx.fillRect(0, 0, CARD, photoH)
    }
  } else {
    ctx.fillStyle = '#055287'
    ctx.fillRect(0, 0, CARD, photoH)
  }

  // The mark sits on the photo, so the picture is OHRR's wherever it travels.
  const mark = await loadImage('/ohrr-mark.png')
  if (mark) {
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, 48, 48, 112, 112, 26)
    ctx.fill()
    ctx.drawImage(mark, 56, 56, 96, 96)
  }

  if (card.kicker) {
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    ctx.font = '800 30px "Nunito", system-ui, sans-serif'
    const text = card.kicker.toUpperCase()
    const w = ctx.measureText(text).width
    ctx.fillStyle = '#eb891c'
    roundRect(ctx, 48, photoH - 86, w + 44, 52, 26)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, 70, photoH - 51)
  }

  // Below: the words.
  let y = photoH + 96
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 76px "Nunito", system-ui, sans-serif'
  for (const line of wrap(ctx, card.title, CARD - 300).slice(0, 2)) {
    ctx.fillText(line, 64, y)
    y += 84
  }

  if (card.subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.86)'
    ctx.font = '600 38px "Open Sans", system-ui, sans-serif'
    for (const line of wrap(ctx, card.subtitle, CARD - 300).slice(0, 3)) {
      ctx.fillText(line, 64, y + 6)
      y += 50
    }
  }

  // The QR keeps the link usable when the caption is stripped by a repost.
  try {
    const qrData = await QRCode.toDataURL(card.link, { errorCorrectionLevel: 'M', margin: 1, width: 400 })
    const qr = await loadImage(qrData)
    if (qr) {
      ctx.fillStyle = '#ffffff'
      roundRect(ctx, CARD - 232, CARD - 232, 184, 184, 20)
      ctx.fill()
      ctx.drawImage(qr, CARD - 224, CARD - 224, 168, 168)
    }
  } catch {
    /* a card without a QR is still a good card */
  }

  ctx.fillStyle = '#eb891c'
  ctx.font = '800 36px "Nunito", system-ui, sans-serif'
  ctx.fillText(card.cta ?? 'Ohio House Rabbit Rescue', 64, CARD - 132)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '600 30px "Open Sans", system-ui, sans-serif'
  ctx.fillText(card.link.replace(/^https?:\/\//, ''), 64, CARD - 84)
}
