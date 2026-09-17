// Midwest BunFest Silent Auction — shared types & formatters for the public
// catalog and the staff manager. Rows come straight from the `raffle_items` /
// `auction_settings` tables (see supabase/migrations/20260917130000_raffle_items.sql).
// The table keeps its `raffle_items` name so the OHRR website can read it too.
import type { Database } from '../../lib/database.types'

export type AuctionItem = Database['public']['Tables']['raffle_items']['Row']
export type AuctionItemInsert = Database['public']['Tables']['raffle_items']['Insert']
export type AuctionItemUpdate = Database['public']['Tables']['raffle_items']['Update']
export type AuctionSettings = Database['public']['Tables']['auction_settings']['Row']

// The event this catalog belongs to (plain text in the table; no FK yet).
export const AUCTION_EVENT_SLUG = 'midwest-bunfest-2026'
// BunFest day, used to turn a staff-entered close time into a timestamptz.
export const AUCTION_EVENT_DATE = '2026-10-25'
export const AUCTION_EVENT_TZ = 'America/New_York'

export const AUCTION_SESSIONS = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'all-day', label: 'All day' },
] as const
export type AuctionSession = (typeof AUCTION_SESSIONS)[number]['value']

export const AUCTION_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'won', label: 'Won' },
] as const
export type AuctionStatus = (typeof AUCTION_STATUSES)[number]['value']

export function sessionLabel(value: string): string {
  return AUCTION_SESSIONS.find((s) => s.value === value)?.label ?? value
}

export function statusLabel(value: string): string {
  return AUCTION_STATUSES.find((s) => s.value === value)?.label ?? value
}

// "$35" / "$12.50"
export function formatValue(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`
}

// Dollars typed by staff ("12.5", "$40") → integer cents, or null when blank.
export function dollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

export function centsToDollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2).replace(/\.00$/, '')
}

/* ---- raffle-ticket pricing (staff-entered in auction_settings; nothing is
   hard-coded). A bundle counts only when BOTH its qty (>= 2) and price are set. ---- */

export type RafflePricing = Pick<
  AuctionSettings,
  'raffle_ticket_price_cents' | 'raffle_bundle_qty' | 'raffle_bundle_price_cents'
>

export function raffleBundle(p: RafflePricing | null | undefined): { qty: number; cents: number } | null {
  const qty = p?.raffle_bundle_qty ?? null
  const cents = p?.raffle_bundle_price_cents ?? null
  if (qty === null || cents === null || qty < 2 || cents < 0) return null
  return { qty, cents }
}

// "$2 each" / "$2 each · 6 for $10" / "6 for $10", or null when nothing is set.
export function rafflePriceLine(p: RafflePricing | null | undefined): string | null {
  const each = p?.raffle_ticket_price_cents ?? null
  const bundle = raffleBundle(p)
  const parts: string[] = []
  if (each !== null && each >= 0) parts.push(`${formatValue(each)} each`)
  if (bundle) parts.push(`${bundle.qty} for ${formatValue(bundle.cents)}`)
  return parts.length ? parts.join(' · ') : null
}

// Total for `qty` tickets: best price using whole bundles first, then singles.
// null when the single-ticket price isn't set (a bundle alone can't price an
// arbitrary quantity) — the app then shows no total.
export function raffleTotalCents(p: RafflePricing | null | undefined, qty: number): number | null {
  const each = p?.raffle_ticket_price_cents ?? null
  if (each === null || each < 0 || qty < 1) return null
  const bundle = raffleBundle(p)
  if (!bundle) return qty * each
  const bundles = Math.floor(qty / bundle.qty)
  const singles = qty % bundle.qty
  // Never charge more for a bundle than the same tickets bought singly.
  const bundleCost = Math.min(bundle.cents, bundle.qty * each)
  return bundles * bundleCost + singles * each
}

// Public order: available items first, then won; within each, sort_order then title.
export function sortAuctionItems<T extends { sort_order: number; title: string; status: string }>(
  items: T[],
): T[] {
  const rank = (s: string) => (s === 'available' ? 0 : 1)
  return [...items].sort(
    (a, b) =>
      rank(a.status) - rank(b.status) ||
      a.sort_order - b.sort_order ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
}

// Staff order: purely sort_order then title (status doesn't move rows around).
export function sortForStaff<T extends { sort_order: number; title: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  )
}

// A neutral placeholder needs the item's initial (real photos only — no icons).
export function itemInitial(title: string): string {
  const ch = title.trim().charAt(0)
  return ch ? ch.toUpperCase() : '?'
}

/* ---- session close times <-> timestamptz on BunFest day, America/New_York ----
   Used by the staff "Auction setup" panel only; the public catalog never shows
   a time. */

// "12:15 pm" in the event's time zone.
export function formatEventTime(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d
    .toLocaleTimeString('en-US', { timeZone: AUCTION_EVENT_TZ, hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
}

// The zone's UTC offset (ms) at a given instant, via Intl (handles DST).
function tzOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asIfUtc - ts
}

// "14:30" (a <input type="time"> value) → ISO timestamptz for that wall-clock
// time on BunFest day in the event's zone. Empty input → null.
export function eventTimeToIso(time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  if (!m) return null
  const [y, mo, d] = AUCTION_EVENT_DATE.split('-').map(Number)
  const wall = Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]))
  let ts = wall - tzOffsetMs(wall, AUCTION_EVENT_TZ)
  ts = wall - tzOffsetMs(ts, AUCTION_EVENT_TZ)
  return new Date(ts).toISOString()
}

// ISO timestamptz → "14:30" in the event's zone (to prefill the time input).
export function isoToEventTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: AUCTION_EVENT_TZ,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}`
}
