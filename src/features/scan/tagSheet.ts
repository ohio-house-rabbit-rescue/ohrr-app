// Paints one US-Letter sheet of OHRR tags (Avery 5163 / 8163: 2" × 4",
// two columns × five rows) onto a canvas, so the native app can hand the
// sheet to the share sheet (AirPrint on iOS, or send it to whoever prints)
// where window.print() does not exist. Same layout as the print CSS.
import QRCode from 'qrcode'
import { letterPage, loadImage, ensureFonts } from '../share/canvas'
import { shortCode, tagUrl } from './codes'

const DPI = 200
const IN = DPI
// Avery 5163: 0.5" top margin, 5/32" side margin, 3/16" column gap, no row gap.
const TOP = 0.5 * IN
const LEFT = 0.15625 * IN
const GAP = 0.1875 * IN
const LW = 4 * IN
const LH = 2 * IN

export async function renderTagSheet(canvas: HTMLCanvasElement, codes: string[], cutLines = true): Promise<void> {
  const ctx = letterPage(canvas)
  await ensureFonts(['800 20px "Nunito"', '900 60px "Nunito"', '500 16px "Open Sans"'])
  const qrs = await Promise.all(codes.slice(0, 10).map((c) => QRCode.toDataURL(tagUrl(c), { errorCorrectionLevel: 'M', margin: 1, width: 400 }).then(loadImage)))
  codes.slice(0, 10).forEach((code, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = LEFT + col * (LW + GAP)
    const y = TOP + row * LH
    if (cutLines) {
      ctx.setLineDash([8, 8])
      ctx.strokeStyle = '#cbd5e1'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, LW, LH)
      ctx.setLineDash([])
    }
    const qr = qrs[i]
    const qrSize = 1.55 * IN
    const qx = x + 0.25 * IN
    const qy = y + (LH - qrSize) / 2
    if (qr) ctx.drawImage(qr, qx, qy, qrSize, qrSize)
    const tx = qx + qrSize + 0.2 * IN
    const tw = x + LW - 0.25 * IN - tx
    ctx.fillStyle = '#0669ac'
    ctx.font = '800 20px "Nunito"'
    ctx.fillText('OHIO HOUSE RABBIT RESCUE', tx, y + 0.45 * IN, tw)
    ctx.fillStyle = '#0f172a'
    ctx.font = '900 76px "Courier New", monospace'
    ctx.fillText(shortCode(code), tx, y + 1.05 * IN, tw)
    ctx.fillStyle = '#64748b'
    ctx.font = '500 20px "Open Sans"'
    ctx.fillText('Scan with the OHRR app,', tx, y + 1.4 * IN, tw)
    ctx.fillText('or type the code.', tx, y + 1.55 * IN, tw)
  })
}
