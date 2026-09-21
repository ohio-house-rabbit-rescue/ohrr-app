// Getting the finished card out of the app: the phone's share sheet when the
// browser offers it (Instagram, Facebook, TikTok, Messages all appear there),
// otherwise save the PNG and copy the caption so it can be pasted.
//
// Inside the native app (Capacitor) the WebView has neither navigator.share
// nor blob downloads, so the same calls go through src/native/share.ts —
// the file is written to the app cache and handed to the system share sheet.
import { isNative } from '../../native/platform'

export type ShareOutcome = 'shared' | 'saved' | 'cancelled'

export function canShareFiles(): boolean {
  if (isNative) return true
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false
    const f = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' })
    return nav.canShare({ files: [f] })
  } catch {
    return false
  }
}

export async function sharePng(blob: Blob, filename: string, caption: string): Promise<ShareOutcome> {
  if (isNative) {
    const { shareFileNative } = await import('../../native/share')
    return shareFileNative(blob, filename, caption)
  }
  const file = new File([blob], filename, { type: 'image/png' })
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], text: caption })
      return 'shared'
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
      // fall through to saving
    }
  }
  savePng(blob, filename)
  await copyText(caption)
  return 'saved'
}

/**
 * "Save" the image. On the web that is a download; in the app it is the
 * share sheet (Save Image / Files / Print live there), so the promise
 * resolves when the sheet closes.
 */
export async function savePngAsync(blob: Blob, filename: string): Promise<ShareOutcome> {
  if (isNative) {
    const { shareFileNative } = await import('../../native/share')
    return shareFileNative(blob, filename)
  }
  savePng(blob, filename)
  return 'saved'
}

export function savePng(blob: Blob, filename: string) {
  if (isNative) {
    void savePngAsync(blob, filename)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Share plain text (a letter, a caption). Falls back to copying it. */
export async function shareText(text: string, title?: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (isNative) {
    const { shareTextNative } = await import('../../native/share')
    return shareTextNative(text, title)
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
