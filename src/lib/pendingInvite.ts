// The staff invite code from an emailed link or QR code, kept on this phone until it's used, so
// creating the sign-in (or confirming an email) between the link and the join screen doesn't lose it.
// Forgotten after 15 days: a code only works for 14, and a stale one would keep the sign-in screen
// saying "you're invited" for ever.
const KEY = 'ohrr.pendingInvite'
const KEY_AT = 'ohrr.pendingInvite.at'
const KEEP_MS = 15 * 24 * 60 * 60 * 1000

export function savePendingInvite(code: string): void {
  try {
    if (!code.trim()) return
    // The same code again keeps its first date.
    if (localStorage.getItem(KEY) !== code.trim() || !localStorage.getItem(KEY_AT)) localStorage.setItem(KEY_AT, String(Date.now()))
    localStorage.setItem(KEY, code.trim())
  } catch {
    /* private window: the link still carries the code */
  }
}

export function getPendingInvite(): string | null {
  try {
    const code = localStorage.getItem(KEY)
    if (!code) return null
    // Saved before dates were kept: no date, so it stays until used or cleared.
    const at = Number(localStorage.getItem(KEY_AT) ?? 0)
    if (at && Date.now() - at > KEEP_MS) {
      clearPendingInvite()
      return null
    }
    return code
  } catch {
    return null
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(KEY_AT)
  } catch {
    /* nothing to clear */
  }
}
