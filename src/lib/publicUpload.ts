// One photo from anyone, for the public forms.
//
// The app's other uploads belong to signed-in staff; these come from visitors,
// so they go to the `public-uploads` bucket, which anyone may add to and nobody
// but staff may change or remove (supabase/migrations/20260922130000_*.sql).
// The image is shrunk on the device first — phone photos are 4000px and the
// bucket caps a file at 8 MB — and the form stores the returned URL with its
// answers, so staff see the picture in the Inbox.
import { supabase, isSupabaseConfigured } from './supabase'
import { downscaleToJpeg } from '../features/raffle/photoUpload'
import { isNative } from '../native/platform'
import { pickPhoto, type PhotoSource } from '../native/camera'

export const PUBLIC_BUCKET = 'public-uploads'

function newName(): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const month = new Date().toISOString().slice(0, 7)
  return `${month}/${id}.jpg`
}

/** Shrink and upload one photo; resolves to its public URL. */
export async function uploadPublicPhoto(file: Blob): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('This build isn’t connected to OHRR yet.')
  const jpeg = await downscaleToJpeg(file)
  const path = newName()
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw new Error(error.message || 'That photo didn’t send.')
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl
}

/** A data URL (the native camera) → Blob, for the uploader above. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

/**
 * Take (or choose) a photo the way this device does it: the native camera
 * inside the app, the file input on the web. Resolves to a Blob, or null when
 * the person backed out. Web callers pass the file from their own <input>.
 */
export async function capturePhoto(source: PhotoSource): Promise<Blob | null> {
  if (!isNative) return null
  const dataUrl = await pickPhoto(source)
  return dataUrl ? dataUrlToBlob(dataUrl) : null
}
