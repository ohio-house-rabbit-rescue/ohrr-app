// Getting a file OUT of the native app. Inside the Capacitor WebView there is
// no navigator.share and a blob <a download> goes nowhere, so anything the
// app paints (share cards, flyers, tag sheets, letters, the My Bunny backup)
// is written to the app's cache folder and handed to the phone's share sheet
// — Instagram, Messages, AirDrop, "Save Image", Print (iOS), Files. Every
// helper is a no-op / falls through on the web; callers check `isNative`.

import { isNative } from './platform'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Could not read the file'))
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.readAsDataURL(blob)
  })
}

/** Write a blob into the app cache and return its native file URI. */
export async function stashFile(blob: Blob, filename: string): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const data = await blobToBase64(blob)
  const res = await Filesystem.writeFile({ path: `share/${filename}`, data, directory: Directory.Cache, recursive: true })
  return res.uri
}

export type NativeShareOutcome = 'shared' | 'cancelled'

/**
 * Hand a file to the share sheet. `text` rides along as the caption where
 * the receiving app accepts one (Messages, Mail; Instagram ignores it).
 */
export async function shareFileNative(blob: Blob, filename: string, text?: string, title?: string): Promise<NativeShareOutcome> {
  if (!isNative) throw new Error('shareFileNative is native-only')
  const { Share } = await import('@capacitor/share')
  const uri = await stashFile(blob, filename)
  try {
    await Share.share({ title, text, files: [uri], dialogTitle: title })
    return 'shared'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/cancel|dismiss/i.test(msg)) return 'cancelled'
    throw err
  }
}

/** Share plain text (a letter, a caption) through the share sheet. */
export async function shareTextNative(text: string, title?: string): Promise<NativeShareOutcome> {
  if (!isNative) throw new Error('shareTextNative is native-only')
  const { Share } = await import('@capacitor/share')
  try {
    await Share.share({ title, text, dialogTitle: title })
    return 'shared'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/cancel|dismiss/i.test(msg)) return 'cancelled'
    throw err
  }
}
