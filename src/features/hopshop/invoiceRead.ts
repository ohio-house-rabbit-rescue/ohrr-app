// Getting the text out of an invoice, on the phone or laptop. Nothing about
// the invoice is sent anywhere to be read:
//   - a PDF from email carries its own text: pdf.js lifts it out, line by line;
//   - photos of a paper invoice (and scanned PDFs, which are only pictures) go
//     through Tesseract text recognition, run in the browser. Its program and
//     English word data download from a free public CDN the first time (about
//     5 MB), then come from the browser's cache.
// Both libraries load only when an invoice is read. invoiceParse.ts turns the
// lines into delivery lines.

export type Progress = (note: string) => void

interface TextPiece {
  str: string
  transform: number[]
  width: number
  height: number
}

/** pdf.js, with its worker, loaded on first use. The legacy build runs on older phones too. */
async function pdfjs() {
  const lib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  lib.GlobalWorkerOptions.workerSrc = worker.default
  return lib
}

/** A page's text pieces → lines, top to bottom, left to right. */
function piecesToLines(pieces: TextPiece[]): string[] {
  const rows: { y: number; h: number; parts: { x: number; w: number; str: string; h: number }[] }[] = []
  for (const it of pieces) {
    if (!it.str.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    const h = Math.abs(it.transform[3]) || it.height || 10
    const row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, 0.45 * Math.min(h, r.h)))
    if (row) row.parts.push({ x, w: it.width, str: it.str, h })
    else rows.push({ y, h, parts: [{ x, w: it.width, str: it.str, h }] })
  }
  rows.sort((a, b) => b.y - a.y)
  return rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x)
    let line = ''
    let end = -Infinity
    for (const p of r.parts) {
      const gap = p.x - end
      // A real gap between pieces is a space; a hairline one is the same word.
      line += line && gap > 0.15 * p.h ? ` ${p.str}` : p.str
      end = p.x + p.w
    }
    return line.replace(/\s+/g, ' ').trim()
  })
}

/** Photos and scanned pages → text, with Tesseract. */
async function recognise(images: (Blob | HTMLCanvasElement)[], progress?: Progress): Promise<string[]> {
  const { createWorker, PSM } = await import('tesseract.js')
  let page = 0
  progress?.('Getting the text reader ready…')
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') progress?.(`Reading page ${page} of ${images.length}… ${Math.round(m.progress * 100)}%`)
    },
  })
  try {
    // One block of text keeps each invoice row on one line.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: '1' })
    const out: string[] = []
    for (const img of images) {
      page += 1
      const src = img instanceof Blob ? await scaledCanvas(img) : img
      const { data } = await worker.recognize(src)
      out.push(...data.text.split('\n'))
    }
    return out.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  } finally {
    await worker.terminate()
  }
}

/** A photo at a size text recognition reads well and quickly (longest side 2400 px). */
async function scaledCanvas(img: Blob): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(img)
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c
}

export interface ReadResult {
  lines: string[]
  /** How the text was got: from the PDF itself, or read from pictures. */
  how: 'pdf' | 'photo'
}

/**
 * Every line of text in the invoice files. A PDF with text is read directly;
 * photos, and PDFs that are only pictures of paper, are read with text
 * recognition.
 */
export async function readInvoiceFiles(files: File[], progress?: Progress): Promise<ReadResult> {
  const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
  const photos = files.filter((f) => !pdfs.includes(f))
  const lines: string[] = []
  let how: ReadResult['how'] = 'pdf'
  const pictures: (Blob | HTMLCanvasElement)[] = [...photos]

  if (pdfs.length) {
    progress?.('Opening the PDF…')
    const lib = await pdfjs()
    for (const f of pdfs) {
      const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise
      const fromText: string[] = []
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n)
        const content = await page.getTextContent()
        fromText.push(...piecesToLines(content.items.filter((i) => 'str' in i) as unknown as TextPiece[]))
      }
      if (fromText.join('').replace(/\s/g, '').length >= 30) {
        lines.push(...fromText)
      } else {
        // A scan: only pictures inside. Draw each page and read it.
        for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
          const page = await doc.getPage(n)
          const view = page.getViewport({ scale: 2 })
          const c = document.createElement('canvas')
          c.width = Math.round(view.width)
          c.height = Math.round(view.height)
          await page.render({ canvasContext: c.getContext('2d')!, viewport: view }).promise
          pictures.push(c)
        }
      }
      await doc.destroy()
    }
  }
  if (pictures.length) {
    how = 'photo'
    lines.push(...(await recognise(pictures, progress)))
  }
  return { lines: lines.filter(Boolean), how }
}
