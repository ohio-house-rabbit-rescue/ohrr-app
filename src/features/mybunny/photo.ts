// Downscale a chosen photo client-side before it's stored. A phone camera JPEG
// is 3–10 MB; a 512px JPEG is ~30–60 KB, which keeps several bunnies well
// inside localStorage's budget. Goes through an <img> element rather than
// createImageBitmap because Safari applies EXIF orientation on <img> decode
// (so portrait photos don't come out sideways) but not reliably on bitmaps.

export const PHOTO_MAX_PX = 512

/** `file` is a picked File/Blob on the web, or a data URL from the native camera plugin. */
export async function downscaleImage(
  file: Blob | string,
  maxPx: number = PHOTO_MAX_PX,
  quality = 0.82,
): Promise<string> {
  const img = await loadImage(file)
  const w0 = img.naturalWidth || img.width
  const h0 = img.naturalHeight || img.height
  if (!w0 || !h0) throw new Error('Could not read that image.')
  const scale = Math.min(1, maxPx / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')
  // JPEG has no alpha — flatten transparency (PNG logos, stickers) onto white.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

function loadImage(file: Blob | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = typeof file === 'string' ? null : URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      reject(new Error('That file doesn’t look like a photo this phone can open.'))
    }
    img.src = objectUrl ?? (file as string)
  })
}

/** Rough size of a data URL in KB — used for a friendly note in the form. */
export function dataUrlKb(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  return Math.round((b64.length * 3) / 4 / 1024)
}
