// The print job for OHRR's Bluetooth label printer (Phomemo PM-249-WF, 4 in
// shipping-label printer, 203 dpi; the driver puts it in the same "tspl-l3"
// group as the PM-344-WF it was first taken for). It speaks a TSPL dialect: a
// few text commands, then the label as a 1-bit picture.
//
// What the printer expects (from the open-source "labelife" driver,
// github.com/thermal-label/labelife, MIT licence, (c) 2026 Mannes Brak — its
// PM-249-WF and PM-344-WF profiles are marked untested, so the plain mode and
// the flip below are there in case a print comes out blank or reversed):
//
//   \r\n DENSITY n \r\n REFERENCE 0,0 \r\n OFFSET 0 mm \r\n
//   SIZE w mm,h mm \r\n GAP 2.00 mm,0.00 mm \r\n DIRECTION 0,0 \r\n CLS \r\n
//   BITMAP 0,0,<bytes per row>,<rows>,4,<picture> \r\n PRINT 1,<copies> \n\r
//
// The picture: rows top to bottom, 8 dots per byte (leftmost dot = top bit),
// 0 = black, as plain TSPL has it. The driver says 1 = black, but OHRR's first
// print on the PM-249-WF (2026-10-27) came out black with a white barcode.
// Mode 4 sends it in 4 KB pieces, each "LZO1X" packed and led by its length
// (4 bytes, little-endian), ending with a zero length. Mode 0 sends the
// bytes as they are.

export const PRINTER_DPI = 203
/** The head is 832 dots (4.1 in) wide; anything wider is turned sideways. */
export const HEAD_DOTS = 832

export type Darkness = 'light' | 'normal' | 'dark'
const DENSITY: Record<Darkness, number> = { light: 6, normal: 10, dark: 14 }

export interface JobOptions {
  copies: number
  darkness: Darkness
  /** Send the picture as it is (mode 0) instead of packed (mode 4). */
  plain: boolean
  /** Swap black and white (1 = black), for a printer that reads the bits the other way. */
  flip: boolean
  /** Shade photos with dots (labels with a photo) instead of a hard cut-off. */
  dither: boolean
}

export interface Raster {
  widthDots: number
  heightDots: number
  bytesPerRow: number
  bits: Uint8Array
}

/**
 * A painted label as black-and-white dots. Labels wider than the head are
 * turned a quarter clockwise first, so a 6 × 4 in label prints on a 4 × 6 roll.
 */
export function toRaster(canvas: HTMLCanvasElement, opts: Pick<JobOptions, 'flip' | 'dither'>): Raster {
  const src = canvas.width > HEAD_DOTS ? rotateClockwise(canvas) : canvas
  const W = src.width
  const H = src.height
  const rgba = src.getContext('2d')!.getImageData(0, 0, W, H).data
  // Grey levels, white where the picture is see-through.
  const grey = new Float32Array(W * H)
  for (let i = 0, p = 0; i < grey.length; i++, p += 4) {
    const a = rgba[p + 3] / 255
    grey[i] = 255 - a * (255 - (0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2]))
  }
  const bytesPerRow = (W + 7) >> 3
  // Start all white, so the spare dots at the end of each row stay blank.
  const bits = new Uint8Array(bytesPerRow * H).fill(opts.flip ? 0 : 0xff)
  // A hard cut-off keeps barcodes and text crisp; dots (Floyd–Steinberg) keep photos readable.
  const cut = opts.dither ? 128 : 175
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const g = grey[i]
      const dark = g < cut
      if (dark) {
        const k = y * bytesPerRow + (x >> 3)
        const dot = 0x80 >> (x & 7)
        if (opts.flip) bits[k] |= dot
        else bits[k] &= ~dot
      }
      if (opts.dither) {
        const err = g - (dark ? 0 : 255)
        if (x + 1 < W) grey[i + 1] += (err * 7) / 16
        if (y + 1 < H) {
          if (x > 0) grey[i + W - 1] += (err * 3) / 16
          grey[i + W] += (err * 5) / 16
          if (x + 1 < W) grey[i + W + 1] += err / 16
        }
      }
    }
  }
  return { widthDots: W, heightDots: H, bytesPerRow, bits }
}

function rotateClockwise(c: HTMLCanvasElement): HTMLCanvasElement {
  const r = document.createElement('canvas')
  r.width = c.height
  r.height = c.width
  const ctx = r.getContext('2d')!
  ctx.translate(r.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(c, 0, 0)
  return r
}

/** The whole job for one label (and its copies), ready to send. */
export function buildJob(r: Raster, opts: JobOptions): Uint8Array {
  const dotsPerMm = PRINTER_DPI / 25.4
  const wMm = Math.max(1, Math.round(r.widthDots / dotsPerMm))
  const hMm = Math.max(1, Math.round(r.heightDots / dotsPerMm))
  const copies = Math.max(1, Math.min(999, Math.round(opts.copies)))
  const head =
    '\r\n' +
    `DENSITY ${DENSITY[opts.darkness]}\r\n` +
    'REFERENCE 0,0\r\n' +
    'OFFSET 0 mm\r\n' +
    `SIZE ${wMm} mm,${hMm} mm\r\n` +
    'GAP 2.00 mm,0.00 mm\r\n' +
    'DIRECTION 0,0\r\n' +
    'CLS\r\n' +
    `BITMAP 0,0,${r.bytesPerRow},${r.heightDots},${opts.plain ? 0 : 4},`
  // This printer family ends the PRINT line "\n\r", the other way round.
  const tail = `\r\nPRINT 1,${copies}\n\r`
  const body = opts.plain ? r.bits : lzoChunked(r.bits)
  return concat([ascii(head), body, ascii(tail)])
}

// --- LZO1X, the simple way -------------------------------------------------
// Ported from the labelife driver's lzo.ts (MIT). Each piece is written as one
// run of literal bytes plus the end marker — valid LZO1X-1 that any LZO
// decoder unpacks, without searching for repeats.

const EOS = [0x11, 0x00, 0x00]
const CHUNK = 4096

function lzoLiteral(input: Uint8Array): Uint8Array {
  const n = input.length
  if (n === 0) return new Uint8Array(EOS)
  if (n <= 238) {
    const out = new Uint8Array(n + 1 + EOS.length)
    out[0] = n + 17
    out.set(input, 1)
    out.set(EOS, n + 1)
    return out
  }
  // Long run: 0, then (n - 18) as zero bytes worth 255 each and a last byte 1..255.
  const target = n - 18
  const zeros = Math.floor((target - 1) / 255)
  const out = new Uint8Array(2 + zeros + n + EOS.length)
  let p = 1 + zeros // out[0..zeros] are already 0
  out[p++] = target - zeros * 255
  out.set(input, p)
  out.set(EOS, p + n)
  return out
}

function lzoChunked(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = []
  for (let at = 0; at < raw.length; at += CHUNK) {
    const packed = lzoLiteral(raw.subarray(at, Math.min(at + CHUNK, raw.length)))
    parts.push(u32le(packed.length), packed)
  }
  parts.push(u32le(0))
  return concat(parts)
}

function u32le(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])
}

function ascii(s: string): Uint8Array {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff
  return out
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
