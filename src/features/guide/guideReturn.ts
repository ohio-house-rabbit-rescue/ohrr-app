// "Back to your level": when a step opens a real page, remember which level it came from for a little while,
// so that page can offer a way back (GuideReturnBar). Kept in this tab's session only. Identical in the app and
// the website.
const KEY = 'ohrr.guide.return'
const FRESH_MS = 2 * 60 * 60 * 1000

export interface GuideReturn {
  to: string
  label: string
}

export function rememberReturn(to: string, label: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ to, label, at: Date.now() }))
  } catch {
    /* no storage: the bar simply doesn't appear */
  }
}

export function readReturn(): GuideReturn | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { to?: unknown; label?: unknown; at?: unknown } | null
    if (!v || typeof v.to !== 'string' || typeof v.label !== 'string' || typeof v.at !== 'number') return null
    if (Date.now() - v.at > FRESH_MS) return null
    return { to: v.to, label: v.label }
  } catch {
    return null
  }
}

export function clearReturn(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}
