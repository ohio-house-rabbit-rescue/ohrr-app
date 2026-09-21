// Small canvas helpers shared by everything the app paints for printing or
// sharing (share cards, flyers, tag sheets, letters). Pure browser APIs —
// nothing to install, works in the WebView too.

/** US Letter at 200 dpi — sharp on paper, ~1 MB as a PNG. */
export const LETTER_W = 1700
export const LETTER_H = 2200

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/** Word-wrap `text` to `maxWidth` using the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line)
        line = w
      } else line = test
    }
    if (line) out.push(line)
  }
  return out
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export async function ensureFonts(sizes: string[] = ['900 120px "Nunito"', '800 48px "Nunito"', '600 44px "Open Sans"']) {
  try {
    await Promise.all(sizes.map((s) => document.fonts.load(s)))
  } catch {
    /* system fonts */
  }
}

/** Start a white US-Letter page; returns the 2D context. */
export function letterPage(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = LETTER_W
  canvas.height = LETTER_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, LETTER_W, LETTER_H)
  return ctx
}
