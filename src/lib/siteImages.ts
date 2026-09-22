// Staff image uploads to the public `site-images` bucket (announcements, home
// screen cards) — the same bucket the website's managers use, so a picture
// added on a phone shows up on the website and vice versa. Gated in the
// database on `announcements.post`.
import { supabase } from './supabase'
import { downscaleToJpeg } from '../features/raffle/photoUpload'
import { isNative } from '../native/platform'
import { pickPhoto, type PhotoSource } from '../native/camera'

const BUCKET = 'site-images'

export async function uploadSiteImage(file: Blob, userId: string): Promise<string> {
  const jpeg = await downscaleToJpeg(file)
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** The native camera / library, for the staff screens inside the app. */
export async function pickSiteImage(source: PhotoSource, userId: string): Promise<string | null> {
  if (!isNative) return null
  const dataUrl = await pickPhoto(source)
  if (!dataUrl) return null
  const blob = await (await fetch(dataUrl)).blob()
  return uploadSiteImage(blob, userId)
}
