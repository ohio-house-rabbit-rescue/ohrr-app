// Native camera / photo library for My Bunny. On the web the form keeps its
// <input type="file" capture> elements; inside the app these call the
// Capacitor Camera plugin instead, which returns a data URL that goes through
// the same downscale as a picked file (src/features/mybunny/photo.ts).

import { isNative } from './platform'

export type PhotoSource = 'camera' | 'library'

/**
 * Take a photo (source 'camera') or pick one from the library ('library').
 * Resolves to a data URL, or null when the person cancelled. Throws with a
 * friendly message when the camera/library couldn't be used (permission
 * denied, no camera, ...). Always resolves null on the web — callers should
 * check `isNative` first and use the file inputs there.
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  if (!isNative) return null
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
  try {
    const photo = await Camera.getPhoto({
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.DataUrl,
      quality: 80,
      // Ask the OS for a modest size up front — the app downscales to 512px
      // anyway, and a 4000px JPEG as a data URL is a lot to hand across the
      // native bridge.
      width: 1200,
      height: 1200,
      correctOrientation: true,
      saveToGallery: false,
      promptLabelHeader: 'Bunny photo',
      promptLabelPhoto: 'Choose from library',
      promptLabelPicture: 'Take a photo',
    })
    return photo.dataUrl ?? null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // The plugin rejects when the person backs out of the camera / picker.
    if (/cancel/i.test(msg)) return null
    if (/denied|permission/i.test(msg)) {
      throw new Error(
        source === 'camera'
          ? 'OHRR doesn’t have permission to use the camera. You can allow it in your phone’s Settings.'
          : 'OHRR doesn’t have permission to see your photos. You can allow it in your phone’s Settings.',
      )
    }
    if (/no camera/i.test(msg)) throw new Error('This device doesn’t have a camera available.')
    throw new Error('Couldn’t get that photo. Please try again.')
  }
}
