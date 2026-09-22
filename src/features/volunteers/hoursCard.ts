// The volunteer-hours card: a square, OHRR-branded image of what someone has
// given, painted on a canvas and handed to the phone's share sheet.
//
// It exists because "how many hours have you done?" gets asked by schools,
// employers and scholarship forms, and a screenshot of a list is a poor answer.
// Same painter approach as the flyers and the tag sheet — no service, no cost.
import { ensureFonts, loadImage, roundRect, wrap } from '../share/canvas'
import { hoursLabel, type MyRecord } from './api'

/** Square, so it fits a social post as well as a school form. */
export const CARD = 1080

export async function renderHoursCard(canvas: HTMLCanvasElement, rec: MyRecord): Promise<void> {
  await ensureFonts(['900 96px "Nunito"', '800 44px "Nunito"', '600 36px "Open Sans"'])
  canvas.width = CARD
  canvas.height = CARD
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This device can’t make the card.')

  // Brand-blue field with a warm block at the foot.
  const grad = ctx.createLinearGradient(0, 0, 0, CARD)
  grad.addColorStop(0, '#0669ac')
  grad.addColorStop(1, '#055287')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, CARD, CARD)

  const mark = await loadImage('/ohrr-mark.png')
  if (mark) {
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, 72, 68, 120, 120, 28)
    ctx.fill()
    ctx.drawImage(mark, 80, 76, 104, 104)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.86)'
  ctx.font = '800 34px "Nunito", system-ui, sans-serif'
  ctx.fillText('OHIO HOUSE RABBIT RESCUE', mark ? 224 : 72, 118)
  ctx.font = '600 30px "Open Sans", system-ui, sans-serif'
  ctx.fillText('Volunteer hours', mark ? 224 : 72, 164)

  // The person
  ctx.fillStyle = '#ffffff'
  ctx.font = '900 76px "Nunito", system-ui, sans-serif'
  const nameLines = wrap(ctx, rec.name, CARD - 144).slice(0, 2)
  let y = 320
  for (const line of nameLines) {
    ctx.fillText(line, 72, y)
    y += 86
  }

  // The number that matters
  const total = rec.totals.confirmed || rec.totals.all
  ctx.fillStyle = '#eb891c'
  ctx.font = '900 190px "Nunito", system-ui, sans-serif'
  ctx.fillText(String(total % 1 === 0 ? total : total.toFixed(1)), 72, y + 170)
  const numW = ctx.measureText(String(total % 1 === 0 ? total : total.toFixed(1))).width
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '800 54px "Nunito", system-ui, sans-serif'
  ctx.fillText(total === 1 ? 'hour' : 'hours', 88 + numW, y + 170)

  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '600 32px "Open Sans", system-ui, sans-serif'
  ctx.fillText(
    rec.totals.confirmed && rec.totals.all > rec.totals.confirmed
      ? `${hoursLabel(rec.totals.all)} logged · ${hoursLabel(rec.totals.confirmed)} confirmed by OHRR`
      : 'confirmed by Ohio House Rabbit Rescue',
    72,
    y + 224,
  )

  // Year by year, newest first, up to four
  const years = rec.by_year.slice(0, 4)
  if (years.length > 0) {
    const boxY = CARD - 300
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundRect(ctx, 72, boxY, CARD - 144, 150, 24)
    ctx.fill()
    const colW = (CARD - 144) / years.length
    years.forEach((yr, i) => {
      const cx = 72 + colW * i + colW / 2
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 54px "Nunito", system-ui, sans-serif'
      ctx.fillText(String(yr.hours % 1 === 0 ? yr.hours : yr.hours.toFixed(1)), cx, boxY + 74)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = '700 28px "Nunito", system-ui, sans-serif'
      ctx.fillText(String(yr.year), cx, boxY + 116)
      ctx.textAlign = 'left'
    })
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '600 28px "Open Sans", system-ui, sans-serif'
  ctx.fillText('ohiohouserabbitrescue.org', 72, CARD - 84)
  const since = rec.started_on ? `Volunteering since ${new Date(`${rec.started_on}T12:00:00`).getFullYear()}` : 'Thank you'
  ctx.textAlign = 'right'
  ctx.fillText(since, CARD - 72, CARD - 84)
  ctx.textAlign = 'left'
}
