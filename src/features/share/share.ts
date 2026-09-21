// Getting the finished card out of the app: the phone's share sheet when the
// browser offers it (Instagram, Facebook, TikTok, Messages all appear there),
// otherwise save the PNG and copy the caption so it can be pasted.

export type ShareOutcome = 'shared' | 'saved' | 'cancelled'

export function canShareFiles(): boolean {
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

export function savePng(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
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
