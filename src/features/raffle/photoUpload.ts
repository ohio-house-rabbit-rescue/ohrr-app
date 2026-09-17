// Phone-first photo upload for auction items: the staff member snaps a photo,
// we downscale it in the browser (max 1280px on the long edge, JPEG) so the
// upload is quick on event-day Wi-Fi, then store it in the public
// `raffle-photos` bucket at <org_id>/<uuid>.jpg (same pattern as rabbit-photos).
import { supabase } from '../../lib/supabase'

export const PHOTO_BUCKET = 'raffle-photos'
const MAX_EDGE = 1280
const JPEG_QUALITY = 0.85

type Drawable = ImageBitmap | HTMLImageElement

async function loadDrawable(file: Blob): Promise<Drawable> {
  // createImageBitmap honours the camera's EXIF orientation, so portrait shots
  // come out upright. Older browsers fall back to an <img>.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // fall through
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('That file doesn’t look like a photo.'))
      img.src = url
    })
  } finally {
    // Revoking after load is safe: the decoded image is already in memory.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

function sizeOf(d: Drawable): { width: number; height: number } {
  if ('naturalWidth' in d) return { width: d.naturalWidth || d.width, height: d.naturalHeight || d.height }
  return { width: d.width, height: d.height }
}

// Returns a JPEG no larger than MAX_EDGE on its longest side.
export async function downscaleToJpeg(file: Blob): Promise<Blob> {
  const drawable = await loadDrawable(file)
  const { width, height } = sizeOf(drawable)
  if (!width || !height) throw new Error('Could not read that photo.')
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the photo on this device.')
  ctx.drawImage(drawable, 0, 0, w, h)
  if ('close' in drawable) drawable.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('Could not process the photo on this device.')
  return blob
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Downscale + upload; resolves to the photo's public URL.
export async function uploadAuctionPhoto(file: Blob, orgId: string): Promise<string> {
  const jpeg = await downscaleToJpeg(file)
  const path = `${orgId}/${newId()}.jpg`
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
}
