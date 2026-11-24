// Where "Back" goes when a screen was opened from another one (?back=…), so a person lands where they
// came from and not on a list they never saw (staff audit 2026-11-24).
//
// Only short codes and ids travel in the address (a box number, a drop-off id), never a name or an email.
import { isBoxCode } from './codes'

export interface BackTo {
  to: string
  /** The short word on the header's Back button. */
  label: string
  /** The full words for a button in the page. */
  long: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function backTarget(back: string | null | undefined): BackTo | null {
  if (!back) return null
  switch (back) {
    case 'items':
      return { to: '/staff/items?list=1', label: 'List', long: 'Back to the list' }
    case 'sheet':
      return { to: '/staff/items/sheet', label: 'Spreadsheet', long: 'Back to the spreadsheet' }
    case 'report':
      return { to: '/staff/donations/report', label: 'Report', long: 'Back to the donation report' }
    case 'summary':
      return { to: '/staff/catalog?summary=1', label: 'Summary', long: 'Back to today’s summary' }
    case 'receive':
      return { to: '/staff/catalog', label: 'Receive', long: 'Back to receiving' }
    case 'receive-boxes':
      return { to: '/staff/catalog?box=1', label: 'Boxes', long: 'Back to filling boxes' }
  }
  const cut = back.indexOf(':')
  const what = cut < 0 ? '' : back.slice(0, cut)
  const id = cut < 0 ? '' : back.slice(cut + 1)
  if (what === 'box' && isBoxCode(id.toUpperCase())) return { to: `/staff/boxes/${id.toUpperCase()}`, label: 'Box', long: 'Back to the box' }
  if (what === 'dropoff' && UUID.test(id)) return { to: `/staff/dropoffs/${id}`, label: 'Drop-off', long: 'Back to the drop-off' }
  return null
}

/** The `back` value as it was given, or null when it isn't one of ours. */
export const cleanBack = (back: string | null | undefined): string | null => (backTarget(back) ? (back as string) : null)

/** `&back=…` for a link, or '' when there is nowhere to go back to. */
export const backParam = (back: string | null | undefined): string => (cleanBack(back) ? `&back=${encodeURIComponent(back as string)}` : '')
