// Silent auction: everything a site needs to show the catalog, register a
// bidder, bid, Buy Now and show "my bids". Framework-free; the website and the
// BunFest site carry a copy (src/lib/auctionClient.ts). Keep the three in sync.
//
// Where things run:
//   * reading the catalog, placing a bid, the bidder's own page → Postgres
//     functions (update 35), called with the public key
//   * registering (saving a card), Buy Now, changing a card → the payment
//     server at AUCTION_API (Cloudflare Pages Functions next to the website),
//     which holds Stripe's secret key
import type { SupabaseClient } from '@supabase/supabase-js'

export const AUCTION_EVENT = 'midwest-bunfest-2026'

/** The payment server. The website uses its own /api; the app and the BunFest site call the website's. */
export const AUCTION_API: string =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_AUCTION_API ?? '').replace(/\/$/, '') ||
  'https://ohrr-website.pages.dev/api/auction'

export type Session = 'morning' | 'afternoon' | 'all-day'
export type Fulfil = 'pickup' | 'ship'
export type SaleKind = 'bid' | 'buy_now' | 'desk'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cash' | 'refunded' | 'void'
export type FulfilStatus = 'pending' | 'picked_up' | 'shipped'

export interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  zip?: string
}

/** One item as auction_item_json() returns it (public-safe). */
export interface AuctionItem {
  id: string
  title: string
  description: string | null
  donated_by: string | null
  value_cents: number | null
  photo_url: string | null
  /** All its photos, cover first (update 38; missing before it). */
  photo_urls?: string[] | null
  session: Session
  status: 'available' | 'won'
  won_kind: SaleKind | null
  sort_order: number
  starting_bid_cents: number | null
  increment_cents: number
  buy_now_cents: number | null
  /** null = pickup only */
  ship_fee_cents: number | null
  current_bid_cents: number | null
  next_min_cents: number
  bid_count: number
  high_bidder_no: number | null
  closes_at: string | null
  is_open: boolean
}

export interface AuctionSettings {
  bidding_enabled: boolean
  bidding_opens_at: string | null
  morning_closes_at: string | null
  afternoon_closes_at: string | null
  extend_minutes: number
  default_increment_cents: number
  stripe_publishable_key: string | null
  intro_text: string | null
  bidding_note: string | null
  pickup_note: string | null
  shipping_note: string | null
  /** Update 44: Buy it now holds the item and the buyer pays at the auction table. */
  buy_now_at_table?: boolean
}

export interface Catalog {
  now: string
  /** The Silent Auction switch (update 38; missing before it = on). */
  enabled?: boolean
  settings: AuctionSettings | null
  items: AuctionItem[]
}

export interface Bidder {
  id: string
  bidder_no: number
  event_slug: string
  name: string
  email: string
  phone: string | null
  fulfil: Fulfil
  address: Address | null
  card_ready: boolean
  card_brand: string | null
  card_last4: string | null
  is_blocked: boolean
  access_token: string
  created_at: string
}

export interface BidRow {
  amount_cents: number
  kind: SaleKind
  at: string
  bidder_no: number | null
  is_high: boolean
}

export interface MyBid {
  bid_id: string
  amount_cents: number
  kind: SaleKind
  at: string
  is_high: boolean
  item: AuctionItem
}

export interface Sale {
  sale_id: string
  item_id: string
  bidder_id: string | null
  kind: SaleKind
  amount_cents: number
  ship_fee_cents: number
  total_cents: number
  fulfil: Fulfil
  ship_address: Address | null
  payment_status: PaymentStatus
  stripe_payment_intent_id: string | null
  failure_message: string | null
  paid_at: string | null
  fulfil_status: FulfilStatus
  tracking: string | null
  shipped_at: string | null
  note: string | null
  created_at: string
  /** Update 44: a Buy it now hold, paid at the table, and its pickup number. */
  at_table?: boolean
  pickup_no?: number | null
  buyer: {
    name: string | null
    email: string | null
    phone: string | null
    bidder_no: number | null
    card_brand: string | null
    card_last4: string | null
  }
  item: AuctionItem | null
}

/** auction_bidder_by_token(): the bidder's own page. */
export interface MyPage {
  bidder: Bidder
  now: string
  settings: AuctionSettings | null
  bids: MyBid[]
  won: Sale[]
}

export type ChargeResult =
  | { ok: true; sale: Sale }
  | { ok: false; requires_action: true; client_secret: string; sale: Sale }
  | { ok: false; requires_action?: false; error: string; sale: Sale }

// -------------------------------------------------------------
// Database reads and bids (public key)
// -------------------------------------------------------------
async function call<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw new Error(cleanMessage(error.message))
  return data as T
}

/** Postgres error text can carry a prefix; people only need the sentence. */
export function cleanMessage(m: string): string {
  return m.replace(/^.*?(?:ERROR|error):\s*/, '').replace(/\s*\(SQLSTATE.*$/, '').trim() || 'Something went wrong.'
}

export function fetchCatalog(db: SupabaseClient, event = AUCTION_EVENT): Promise<Catalog> {
  return call<Catalog>(db, 'auction_catalog', { p_event: event })
}

export function fetchItemBids(db: SupabaseClient, itemId: string): Promise<BidRow[]> {
  return call<BidRow[]>(db, 'auction_item_bids', { p_item_id: itemId })
}

export function fetchItemByCode(db: SupabaseClient, code: string): Promise<AuctionItem | null> {
  return call<AuctionItem | null>(db, 'auction_item_by_code', { p_code: code })
}

export function fetchMyPage(db: SupabaseClient, token: string): Promise<MyPage | null> {
  return call<MyPage | null>(db, 'auction_bidder_by_token', { p_token: token })
}

export function placeBid(db: SupabaseClient, token: string, itemId: string, amountCents: number): Promise<{ ok: true; bid_id: string; item: AuctionItem }> {
  return call(db, 'place_bid', { p_token: token, p_item_id: itemId, p_amount_cents: amountCents })
}

export function updateBidder(
  db: SupabaseClient,
  token: string,
  patch: { name: string; phone: string; fulfil: Fulfil; address: Address | null },
): Promise<Bidder> {
  return call<Bidder>(db, 'auction_update_bidder', {
    p_token: token,
    p_name: patch.name,
    p_phone: patch.phone,
    p_fulfil: patch.fulfil,
    p_address: patch.address,
  })
}

// -------------------------------------------------------------
// Buy it now, pay at the table (update 44): no card online — the item is
// held under a pickup number and paid for at the auction table.
// -------------------------------------------------------------
export interface TableHold {
  sale_id: string
  claim_token: string
  pickup_no: number
  item_id: string
  title: string
  amount_cents: number
}

export type HoldState = 'waiting' | 'paid' | 'done' | 'cancelled'

/** auction_table_claim(): what the buyer's screen shows. */
export interface HoldStatus {
  pickup_no: number
  item_id: string
  title: string
  photo_url: string | null
  amount_cents: number
  buyer_name: string | null
  created_at: string
  payment_status: PaymentStatus
  fulfil_status: FulfilStatus
  paid_at: string | null
  state: HoldState
  pickup_note: string | null
}

export function holdItem(db: SupabaseClient, itemId: string, name: string, phone: string): Promise<TableHold> {
  return call<TableHold>(db, 'auction_buy_now_claim', { p_item_id: itemId, p_name: name, p_phone: phone })
}

export function fetchHold(db: SupabaseClient, token: string): Promise<HoldStatus | null> {
  return call<HoldStatus | null>(db, 'auction_table_claim', { p_token: token })
}

// -------------------------------------------------------------
// The payment server
// -------------------------------------------------------------
async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${AUCTION_API}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('We could not reach the payment server. Check your connection and try again.')
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok && !('ok' in data)) throw new Error((data.error as string) || `The payment server answered ${res.status}.`)
  return data as T
}

export interface RegisterInput {
  event?: string
  name: string
  email: string
  phone?: string
  fulfil: Fulfil
  address?: Address | null
}

export const auctionApi = {
  /** Make the bidder record and get the client_secret for Stripe's card form. */
  register: (input: RegisterInput) => post<{ bidder: Bidder; client_secret: string }>('register', { event: AUCTION_EVENT, ...input }),
  /** After the card form succeeds: tell the server which setup it was. */
  cardSaved: (token: string, setupIntentId: string) => post<{ bidder: Bidder }>('card-saved', { token, setup_intent: setupIntentId }),
  /** A new card form for an existing bidder. */
  newCard: (token: string) => post<{ client_secret: string }>('new-card', { token }),
  /** Buy the item now on the saved card. */
  buyNow: (token: string, itemId: string) => post<ChargeResult>('buy-now', { token, item_id: itemId }),
  /** After the bank's extra check: how did the payment end? */
  complete: (token: string, saleId: string) => post<{ sale: Sale; stripe_status?: string }>('complete', { token, sale_id: saleId }),
  /** A winner pays for a declined or unpaid sale on the card they have now. */
  pay: (token: string, saleId: string) => post<ChargeResult>('pay', { token, sale_id: saleId }),
  /** Staff: close & charge, retry one, or pass to the next bidder. */
  charge: (
    jwt: string,
    body: { org_id: string; event: string } | { sale_id: string } | { offer_next_sale_id: string },
  ) =>
    post<{ results: ChargeResult[]; errors: { item_id?: string; error: string }[]; message?: string }>('charge', body, {
      authorization: `Bearer ${jwt}`,
    }),
  /** Is the server set up? (No secrets in the answer.) */
  health: async () => {
    try {
      const r = await fetch(`${AUCTION_API}/health`)
      return (await r.json()) as { ok: boolean; stripe: boolean; stripe_mode: 'live' | 'test' | null; webhook: boolean; supabase: boolean }
    } catch {
      return null
    }
  },
}

// -------------------------------------------------------------
// Remembering the bidder on this device
// -------------------------------------------------------------
const KEY = 'ohrr.auction.bidder'

export interface RememberedBidder {
  access_token: string
  event_slug: string
  name: string
  bidder_no: number
}

export function rememberBidder(b: Bidder): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ access_token: b.access_token, event_slug: b.event_slug, name: b.name, bidder_no: b.bidder_no }))
  } catch {
    /* private mode */
  }
}

export function recallBidder(event = AUCTION_EVENT): RememberedBidder | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const b = JSON.parse(raw) as RememberedBidder
    return b && b.access_token && b.event_slug === event ? b : null
  } catch {
    return null
  }
}

export function forgetBidder(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

// The holds made on this device (so the pickup number survives a reload), and
// the name and phone last used, to fill the form next time.
const HOLDS_KEY = 'ohrr.auction.holds'
const BUYER_KEY = 'ohrr.auction.buyer'

export interface RememberedHold {
  claim_token: string
  item_id: string
  pickup_no: number
  title: string
  amount_cents: number
}

export function recallHolds(): RememberedHold[] {
  try {
    const list = JSON.parse(localStorage.getItem(HOLDS_KEY) ?? '[]') as RememberedHold[]
    return Array.isArray(list) ? list.filter((h) => h && h.claim_token && h.item_id) : []
  } catch {
    return []
  }
}

export function rememberHold(h: TableHold): void {
  try {
    const keep = recallHolds().filter((x) => x.item_id !== h.item_id).slice(-19)
    const { claim_token, item_id, pickup_no, title, amount_cents } = h
    localStorage.setItem(HOLDS_KEY, JSON.stringify([...keep, { claim_token, item_id, pickup_no, title, amount_cents }]))
  } catch {
    /* private mode */
  }
}

export function forgetHold(token: string): void {
  try {
    localStorage.setItem(HOLDS_KEY, JSON.stringify(recallHolds().filter((x) => x.claim_token !== token)))
  } catch {
    /* ignore */
  }
}

export function recallBuyer(): { name: string; phone: string } {
  try {
    const b = JSON.parse(localStorage.getItem(BUYER_KEY) ?? '{}') as { name?: string; phone?: string }
    return { name: b.name ?? '', phone: b.phone ?? '' }
  } catch {
    return { name: '', phone: '' }
  }
}

export function rememberBuyer(name: string, phone: string): void {
  try {
    localStorage.setItem(BUYER_KEY, JSON.stringify({ name, phone }))
  } catch {
    /* ignore */
  }
}

// -------------------------------------------------------------
// Words and numbers
// -------------------------------------------------------------

/** "$35" or "$12.50". */
export function money(cents: number | null | undefined): string {
  if (cents == null) return ''
  const d = cents / 100
  return Number.isInteger(d) ? `$${d.toLocaleString('en-US')}` : `$${d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function dollarsToCents(v: string | number): number | null {
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

const SESSION_LABEL: Record<Session, string> = { morning: 'Morning', afternoon: 'Afternoon', 'all-day': 'All day' }
export function sessionLabel(s: Session): string {
  return SESSION_LABEL[s] ?? s
}

/** How long until the item closes, in plain words; `now` comes from the server. */
export function closesIn(closesAt: string | null, nowIso: string): string {
  if (!closesAt) return ''
  const ms = new Date(closesAt).getTime() - new Date(nowIso).getTime()
  if (ms <= 0) return 'Closed'
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'Closing in under a minute'
  if (m < 60) return `Closes in ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Closes in ${h}h ${String(m % 60).padStart(2, '0')}m`
  const d = Math.floor(h / 24)
  return `Closes in ${d} day${d === 1 ? '' : 's'}`
}

export function fmtWhen(iso: string | null, tz = 'America/New_York'): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** One line under an item: "Current bid $45 · 6 bids" / "Starting bid $20" / "Sold". */
export function bidLine(item: AuctionItem): string {
  if (item.status === 'won') return item.won_kind === 'buy_now' ? `Sold for ${money(item.current_bid_cents)}` : 'Sold'
  if (item.current_bid_cents != null) {
    return `Current bid ${money(item.current_bid_cents)} · ${item.bid_count} bid${item.bid_count === 1 ? '' : 's'}`
  }
  return item.starting_bid_cents ? `Starting bid ${money(item.starting_bid_cents)}` : 'No bids yet'
}

/** Why bidding isn't possible, or null when it is. */
export function whyClosed(item: AuctionItem, settings: AuctionSettings | null, nowIso: string): string | null {
  if (item.status === 'won') return 'This item has been sold.'
  if (settings?.buy_now_at_table && !settings.bidding_enabled) return 'Bid on the paper sheet at the auction table.'
  if (!settings || !settings.bidding_enabled) return 'Online bidding is not open yet.'
  if (settings.bidding_opens_at && new Date(nowIso) < new Date(settings.bidding_opens_at)) return `Bidding opens ${fmtWhen(settings.bidding_opens_at)}.`
  if (item.closes_at && new Date(nowIso) >= new Date(item.closes_at)) return 'Bidding on this item has closed.'
  return null
}

/** The bidder's total if they win: hammer + shipping (when they chose shipping and the item ships). */
export function shippingFor(item: AuctionItem, bidder: { fulfil: Fulfil } | null): number {
  return bidder?.fulfil === 'ship' && item.ship_fee_cents != null ? item.ship_fee_cents : 0
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Card declined',
  cash: 'Paid at the desk',
  refunded: 'Refunded',
  void: 'Cancelled',
}

export const FULFIL_LABEL: Record<FulfilStatus, string> = {
  pending: 'Not yet',
  picked_up: 'Picked up',
  shipped: 'Shipped',
}
