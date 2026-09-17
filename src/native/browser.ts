// External links inside the native app. In a browser a plain
// <a target="_blank"> is right; inside the Capacitor WebView that same link
// would either open inside the app (with no way back) or do nothing, so
// http(s) links to other sites are handed to the system browser instead
// (Chrome Custom Tab on Android, SFSafariViewController on iOS). Donate /
// merch / Petfinder / vet-website links therefore always leave the app —
// which is also what the app stores require for donations.

import { isNative } from './platform'

/** Open a URL outside the app. On the web this is just window.open in a new tab. */
export async function openExternal(url: string): Promise<void> {
  if (!isNative) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url, presentationStyle: 'popover' })
  } catch (err) {
    // Shouldn't happen in the app, but never swallow a donate link: let the
    // WebView have it rather than doing nothing.
    console.warn('[native] Browser.open failed, falling back', err)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * True for a link that should leave the app: http(s) to a different origin,
 * or anything marked target="_blank". Same-origin React Router links, tel:,
 * mailto:, sms: and geo: are left to the WebView, which already hands those
 * schemes to the phone.
 */
export function isExternalHref(href: string, target?: string | null): boolean {
  if (!/^https?:\/\//i.test(href)) return false
  if (target === '_blank') return true
  try {
    return new URL(href).origin !== window.location.origin
  } catch {
    return false
  }
}

/**
 * One document-level click handler so every existing <a> in the app keeps
 * working unchanged. Returns the cleanup function. No-op on the web.
 */
export function installExternalLinkHandler(): () => void {
  if (!isNative) return () => {}
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const el = (e.target as Element | null)?.closest?.('a[href]')
    if (!(el instanceof HTMLAnchorElement)) return
    const href = el.href
    if (!isExternalHref(href, el.getAttribute('target'))) return
    e.preventDefault()
    void openExternal(href)
  }
  document.addEventListener('click', onClick)
  return () => document.removeEventListener('click', onClick)
}
