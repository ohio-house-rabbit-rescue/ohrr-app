// The staff invite code from an emailed link or QR code, kept on this phone until it's used, so
// creating the sign-in (or confirming an email) between the link and the join screen doesn't lose it.
const KEY = 'ohrr.pendingInvite'

export function savePendingInvite(code: string): void {
  try {
    if (code.trim()) localStorage.setItem(KEY, code.trim())
  } catch {
    /* private window: the link still carries the code */
  }
}

export function getPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
