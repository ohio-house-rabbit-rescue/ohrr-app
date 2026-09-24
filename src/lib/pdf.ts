// A one-page PDF made from a painted page (a volunteer's hours letter), with
// no library and no service: the page goes in as a JPEG, which PDF readers
// understand natively. US Letter, the picture filling the page.
// (The app and the website each keep this file; keep the two the same.)

/** The canvas as a PDF file. */
export async function canvasToPdf(canvas: HTMLCanvasElement, title = 'Ohio House Rabbit Rescue'): Promise<Blob> {
  const jpeg = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the page.'))), 'image/jpeg', 0.92),
  )
  return jpegPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height, title)
}

export function jpegPdf(jpeg: Uint8Array, width: number, height: number, title: string, pageW = 612, pageH = 792): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let size = 0
  const push = (p: Uint8Array | string) => {
    const b = typeof p === 'string' ? enc.encode(p) : p
    parts.push(b)
    size += b.length
  }
  const obj = (n: number, body: () => void) => {
    offsets[n] = size
    push(`${n} 0 obj\n`)
    body()
    push('\nendobj\n')
  }
  // Plain ASCII in the title: it is only the name a PDF reader shows.
  const safeTitle = title.replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '')
  const draw = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`

  push('%PDF-1.4\n%âãÏÓ\n')
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'))
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'))
  obj(3, () =>
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
  )
  obj(4, () => {
    push(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    )
    push(jpeg)
    push('\nendstream')
  })
  obj(5, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`))
  obj(6, () => push(`<< /Title (${safeTitle}) /Producer (Ohio House Rabbit Rescue) >>`))

  const xref = size
  push('xref\n0 7\n0000000000 65535 f \n')
  for (let i = 1; i <= 6; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
