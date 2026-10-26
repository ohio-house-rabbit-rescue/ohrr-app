// OHRR's auction payments, on Square (update 45). Replaces the Stripe server
// that sat next to the website (Cloudflare Pages Functions).
//
//   GET  health      is it set up? (never shows a secret)
//   POST register    { event, name, email, phone?, fulfil, address?, card_token }
//                    → the bidder, with the card saved on Square
//   POST new-card    { token, card_token } → change the saved card
//   POST buy-now     { token, item_id }    → charge the Buy it now price
//   POST pay         { token, sale_id }    → a winner pays a declined sale
//   POST charge      staff (Authorization: Bearer <their session>)
//                    { org_id, event } close & charge · { sale_id } retry one ·
//                    { offer_next_sale_id } pass it to the next bidder
//   POST locations   staff { event } → the Square locations, to pick one
//   POST close-due   the database, every five minutes (x-ohrr-secret):
//                    charge the winners of every auction that charges itself,
//                    and try again any charge Square never answered
//
// Never twice: each charge takes a lock on its sale (auction_charge_begin),
// and Square's idempotency key is made from the sale, the card, how many times
// it was declined and the earlier payment, so a repeat of the same attempt is
// answered with the same payment. Only a card problem marks a sale declined;
// if Square is slow or down the sale stays unpaid and is tried again.
//
// The card number goes from Square's card form straight to Square; this
// function only ever sees a one-time token, and the database keeps Square's
// ids. Secrets (Supabase → Edge Functions → Secrets):
//   SQUARE_ACCESS_TOKEN          the production access token
//   SQUARE_SANDBOX_ACCESS_TOKEN  the sandbox one, for test runs
// Which one is used follows the auction's application id: "sandbox-…" = sandbox
// (and a sandbox auction never falls back to the real token).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY come with
// every Edge Function. Deploy with "Verify JWT" OFF (the browsers call it
// without a session; staff calls are checked against Postgres instead).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SQUARE_VERSION = '2026-08-19'
const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: noSession })

// -------------------------------------------------------------
// HTTP
// -------------------------------------------------------------
class HttpError extends Error {
  constructor(public status: number, message: string, public extra: Record<string, unknown> = {}) {
    super(message)
  }
}

function originAllowed(origin: string): boolean {
  const fixed = [
    'https://ohrr-app.pages.dev',
    'https://ohrr-website.pages.dev',
    'https://ohrr-bunfest.pages.dev',
    'https://ohiohouserabbitrescue.org',
    'https://www.ohiohouserabbitrescue.org',
    'https://midwestbunfest.org',
    'https://www.midwestbunfest.org',
    'capacitor://localhost', // iPhone app
    'https://localhost', // Android app
    'http://localhost',
  ]
  if (fixed.includes(origin)) return true
  if (/^https:\/\/[a-z0-9-]+\.ohrr-(app|website|bunfest)\.pages\.dev$/.test(origin)) return true
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

function cors(origin: string): Record<string, string> {
  return originAllowed(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization, apikey, x-client-info',
        'access-control-max-age': '86400',
        vary: 'Origin',
      }
    : {}
}

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw new HttpError(400, error.message)
  return data as T
}

function userClient(jwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: noSession, global: { headers: { Authorization: `Bearer ${jwt}` } } })
}

// -------------------------------------------------------------
// Shapes from the database (update 35 / 45)
// -------------------------------------------------------------
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cash' | 'refunded' | 'void'
interface Address { line1?: string; line2?: string; city?: string; state?: string; zip?: string }
interface Bidder {
  id: string
  bidder_no: number
  event_slug: string
  name: string
  email: string
  phone: string | null
  fulfil: 'pickup' | 'ship'
  address: Address | null
  card_ready: boolean
  is_blocked: boolean
  access_token: string
  // Square's ids, kept in the columns that once held Stripe's.
  stripe_customer_id?: string | null
  stripe_payment_method_id?: string | null
}
interface Sale {
  sale_id: string
  item_id: string
  bidder_id: string | null
  event_slug?: string
  kind: 'bid' | 'buy_now' | 'desk'
  total_cents: number
  payment_status: PaymentStatus
  stripe_payment_intent_id: string | null
  decline_count?: number
  receipt_url?: string | null
  buyer: { email: string | null; stripe_customer_id: string | null; stripe_payment_method_id: string | null; [k: string]: unknown }
  item: { title?: string } | null
  [k: string]: unknown
}
interface Settings {
  org_id: string
  event_slug: string
  title: string | null
  square_application_id: string | null
  square_location_id: string | null
}

const publicBidder = (b: Bidder) => {
  const { stripe_customer_id: _c, stripe_payment_method_id: _p, ...rest } = b
  return rest
}
const publicSale = (s: Sale): Sale => ({ ...s, buyer: { ...s.buyer, stripe_customer_id: null, stripe_payment_method_id: null } })

async function settingsFor(event: string): Promise<Settings> {
  const { data, error } = await db
    .from('auction_settings')
    .select('org_id, event_slug, title, square_application_id, square_location_id')
    .eq('event_slug', event)
    .limit(1)
    .maybeSingle()
  if (error) throw new HttpError(400, error.message)
  if (!data) throw new HttpError(404, 'That auction is not set up.')
  return data as Settings
}

const auctionName = (s: Settings) =>
  s.title || (s.event_slug.startsWith('midwest-bunfest') ? 'Midwest BunFest Silent Auction' : 'OHRR Online Auction')

// -------------------------------------------------------------
// Square
// -------------------------------------------------------------
interface SquareError { code?: string; detail?: string; category?: string }
interface SquarePayment { id: string; status: string; receipt_url?: string }

function squareFor(s: Settings) {
  const sandbox = (s.square_application_id ?? '').startsWith('sandbox-')
  const token = Deno.env.get(sandbox ? 'SQUARE_SANDBOX_ACCESS_TOKEN' : 'SQUARE_ACCESS_TOKEN')
  if (!token) {
    throw new HttpError(503, `Card payments are not set up yet (the Square ${sandbox ? 'sandbox ' : ''}access token is missing).`)
  }
  if (!s.square_location_id) throw new HttpError(503, 'Card payments are not set up yet (no Square location chosen).')
  const base = sandbox ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com'
  return {
    locationId: s.square_location_id,
    async call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; data: T & { errors?: SquareError[] } }> {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'square-version': SQUARE_VERSION, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as T & { errors?: SquareError[] }
      return { ok: res.ok && !data.errors?.length, data }
    },
  }
}

/** A problem with the card itself (declined, expired …), not with Square or OHRR. */
const isCardProblem = (errors: SquareError[] | undefined) => Boolean(errors?.some((e) => e.category === 'PAYMENT_METHOD_ERROR'))

/** Square wants E.164 (+16145551234); anything else is left out. */
function e164(phone: string | null): string | undefined {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (phone.trim().startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return undefined
}

/** Leave out empty fields (Square rejects empty strings in an address). */
const compact = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>

/** Square's error, in words a bidder can act on. */
function squareMessage(errors: SquareError[] | undefined, fallback: string): string {
  const e = errors?.[0]
  if (!e) return fallback
  const known: Record<string, string> = {
    CARD_DECLINED: 'The card was declined.',
    GENERIC_DECLINE: 'The card was declined.',
    INSUFFICIENT_FUNDS: 'The card was declined (not enough funds).',
    CVV_FAILURE: 'The security code did not match.',
    ADDRESS_VERIFICATION_FAILURE: 'The ZIP code did not match the card.',
    INVALID_EXPIRATION: 'The expiry date is not right.',
    CARD_EXPIRED: 'The card has expired.',
    INVALID_CARD: 'That card can’t be used.',
    CARD_NOT_SUPPORTED: 'That card can’t be used here.',
    CARD_TOKEN_EXPIRED: 'The card form timed out. Please enter the card again.',
    CARD_TOKEN_USED: 'Please enter the card again.',
    VERIFY_CVV_FAILURE: 'The security code did not match.',
    VERIFY_AVS_FAILURE: 'The ZIP code did not match the card.',
    CARD_DECLINED_VERIFICATION_REQUIRED: 'Your bank wants to check this card. Please add it again.',
    TRANSACTION_LIMIT: 'The card was declined (over its limit).',
  }
  return (e.code && known[e.code]) || e.detail || fallback
}

/** Save a card on Square for this bidder (making their Square customer first). */
async function saveCard(s: Settings, bidder: Bidder, cardToken: string): Promise<Bidder> {
  const sq = squareFor(s)
  let customerId = bidder.stripe_customer_id ?? null
  if (!customerId) {
    const [given, ...rest] = bidder.name.split(/\s+/)
    const c = await sq.call<{ customer?: { id: string } }>('POST', '/v2/customers', {
      idempotency_key: `cust-${bidder.id}`,
      given_name: given,
      family_name: rest.join(' ') || undefined,
      email_address: bidder.email,
      phone_number: e164(bidder.phone),
      reference_id: `bidder-${bidder.bidder_no}`,
      note: `${auctionName(s)} — bidder #${bidder.bidder_no}`,
    })
    if (!c.ok || !c.data.customer) throw new HttpError(400, squareMessage(c.data.errors, 'Square could not save your details. Please try again.'))
    customerId = c.data.customer.id
    await rpc(db, 'auction_set_card', { p_bidder_id: bidder.id, p_customer: customerId, p_payment_method: null, p_brand: null, p_last4: null })
  }
  const a = bidder.address
  const card = await sq.call<{ card?: { id: string; card_brand?: string; last_4?: string } }>('POST', '/v2/cards', {
    idempotency_key: crypto.randomUUID(),
    source_id: cardToken,
    card: {
      customer_id: customerId,
      cardholder_name: bidder.name,
      reference_id: `bidder-${bidder.bidder_no}`,
      billing_address: a?.line1
        ? compact({ address_line_1: a.line1, address_line_2: a.line2, locality: a.city, administrative_district_level_1: a.state, postal_code: a.zip, country: 'US' })
        : undefined,
    },
  })
  if (!card.ok || !card.data.card) throw new HttpError(400, squareMessage(card.data.errors, 'The card was not saved. Please check it and try again.'))
  const old = bidder.stripe_payment_method_id
  const brand = (card.data.card.card_brand ?? '').replace(/_/g, ' ').toLowerCase() || null
  const saved = await rpc<Bidder>(db, 'auction_set_card', {
    p_bidder_id: bidder.id,
    p_customer: null,
    p_payment_method: card.data.card.id,
    p_brand: brand,
    p_last4: card.data.card.last_4 ?? null,
  })
  // The old card is no longer needed on Square.
  if (old && old !== card.data.card.id) await sq.call('POST', `/v2/cards/${encodeURIComponent(old)}/disable`).catch(() => null)
  return saved
}

type ChargeResult = { ok: true; sale: Sale } | { ok: false; error: string; sale: Sale }

const hex8 = async (text: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).slice(0, 4), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')

/**
 * Square's idempotency key for one attempt (45 characters at most): the same
 * sale, card, decline count and earlier payment always give the same key.
 */
const attemptKey = async (saleId: string, cardId: string, declines: number, previous: string | null) =>
  `${saleId}-${await hex8(`${cardId}|${declines}|${previous ?? ''}`)}`

const busy = (sale: Sale): ChargeResult => ({
  ok: false,
  error: 'This payment is already being made. Check again in a couple of minutes.',
  sale: publicSale(sale),
})

/**
 * Charge a sale to the winner's saved card — the card they have NOW. A card
 * problem: a Buy it now is voided (the item goes straight back up) and a
 * winning bid is kept as 'failed' so the bidder can pay with another card, or
 * staff can pass it to the next bidder or take cash (`onFailure`). Square slow
 * or down: the sale stays unpaid and the five-minute check tries it again.
 */
async function chargeSale(input: Sale, onFailure: 'failed' | 'void'): Promise<ChargeResult> {
  if (input.payment_status === 'paid' || input.payment_status === 'cash') return { ok: true, sale: publicSale(input) }
  if (input.payment_status !== 'pending' && input.payment_status !== 'failed') {
    return { ok: false, error: `This sale is ${input.payment_status}.`, sale: publicSale(input) }
  }
  if (!input.bidder_id) {
    return { ok: false, error: 'This sale has no online bidder. Record how it was paid at the desk.', sale: publicSale(input) }
  }
  const bidder = await rpc<Bidder | null>(db, 'auction_bidder_secure', { p_bidder_id: input.bidder_id, p_token: null })
  if (!bidder) throw new HttpError(404, 'Bidder not found.')
  if (bidder.is_blocked) return { ok: false, error: 'This bidder is blocked.', sale: publicSale(input) }

  // The lock: from here on nobody else charges this sale.
  const sale = await rpc<Sale | null>(db, 'auction_charge_begin', { p_sale_id: input.sale_id })
  if (!sale) return busy(input)
  const finalize = async (status: PaymentStatus, paymentId: string | null, failure?: string) =>
    publicSale(await rpc<Sale>(db, 'auction_finalize_sale', { p_sale_id: sale.sale_id, p_status: status, p_payment_intent: paymentId, p_failure: failure ?? null }))
  const paid = async (p: SquarePayment): Promise<ChargeResult> => {
    const done = await finalize('paid', p.id)
    if (!p.receipt_url) return { ok: true, sale: done }
    try {
      await rpc(db, 'auction_set_receipt', { p_sale_id: sale.sale_id, p_receipt_url: p.receipt_url })
    } catch (e) {
      console.error('receipt', e)
    }
    return { ok: true, sale: { ...done, receipt_url: p.receipt_url } }
  }
  // Square slow, down or refusing for a reason that isn't the card: nothing
  // changes (the lock runs out after two minutes, then it can be tried again).
  const notNow = async (message: string): Promise<ChargeResult> => ({ ok: false, error: message, sale: publicSale(sale) })

  if (sale.total_cents <= 0) return { ok: true, sale: await finalize('paid', null) }
  const cardId = bidder.stripe_payment_method_id
  if (!bidder.card_ready || !bidder.stripe_customer_id || !cardId) {
    return { ok: false, error: 'There is no card on file for this bidder.', sale: await finalize(onFailure, null, 'No card on file') }
  }

  const settings = await settingsFor(sale.event_slug ?? '')
  const sq = squareFor(settings)

  // An earlier attempt on this sale: never charge twice.
  const previous = sale.stripe_payment_intent_id
  if (previous) {
    const p = await sq.call<{ payment?: SquarePayment }>('GET', `/v2/payments/${encodeURIComponent(previous)}`)
    const st = p.ok ? p.data.payment?.status : undefined
    if (st === 'COMPLETED') return await paid(p.data.payment!)
    // Only a payment Square has finished with (FAILED or CANCELED) lets a new one start.
    if (st !== 'FAILED' && st !== 'CANCELED') {
      return await notNow(st ? 'The payment is still going through. Check again in a minute.' : 'We could not check with Square. We’ll try again in a few minutes.')
    }
  }

  const title = sale.item?.title ?? 'auction item'
  const r = await sq.call<{ payment?: SquarePayment }>('POST', '/v2/payments', {
    idempotency_key: await attemptKey(sale.sale_id, cardId, sale.decline_count ?? 0, previous),
    source_id: cardId,
    customer_id: bidder.stripe_customer_id,
    amount_money: { amount: sale.total_cents, currency: 'USD' },
    location_id: sq.locationId,
    autocomplete: true,
    reference_id: sale.sale_id.slice(0, 40),
    note: `${auctionName(settings)}: ${title}`.slice(0, 500),
    buyer_email_address: bidder.email || undefined,
    // The bidder agreed when they saved the card; the close charges it without them.
    customer_details: { customer_initiated: sale.kind === 'buy_now', seller_keyed_in: false },
  })
  const p = r.data.payment
  if (r.ok && p?.status === 'COMPLETED') return await paid(p)
  if (r.ok && p && (p.status === 'APPROVED' || p.status === 'PENDING')) {
    return { ok: false, error: 'The payment is going through. Check again in a minute.', sale: await finalize('pending', p.id) }
  }
  if (isCardProblem(r.data.errors) || (r.ok && p && (p.status === 'FAILED' || p.status === 'CANCELED'))) {
    const message = squareMessage(r.data.errors, 'The card was not charged.')
    return { ok: false, error: message, sale: await finalize(onFailure, p?.id ?? null, message) }
  }
  console.error('square payment', JSON.stringify(r.data.errors ?? []))
  if (r.data.errors?.some((e) => e.code === 'IDEMPOTENCY_KEY_REUSED')) {
    return await notNow('Square refused a repeat of this payment. OHRR staff will sort it out.')
  }
  return await notNow('We could not reach Square. We’ll try again in a few minutes — check Your bids.')
}

async function bidderByToken(token: unknown): Promise<Bidder> {
  if (!isUuid(token)) throw new HttpError(400, 'Please register to bid first.')
  const b = await rpc<Bidder | null>(db, 'auction_bidder_secure', { p_bidder_id: null, p_token: token })
  if (!b) throw new HttpError(404, 'We could not find your bidder registration. Please register again.')
  return b
}

function pickAddress(v: unknown): Address | null {
  if (!v || typeof v !== 'object') return null
  const a = v as Record<string, unknown>
  return { line1: str(a.line1, 120), line2: str(a.line2, 120) || undefined, city: str(a.city, 80), state: str(a.state, 40), zip: str(a.zip, 20) }
}

async function chargeAll(sales: Sale[], errors: { item_id?: string; error: string }[]): Promise<ChargeResult[]> {
  const results: ChargeResult[] = []
  for (const sale of sales) {
    try {
      results.push(await chargeSale(sale, sale.kind === 'buy_now' ? 'void' : 'failed'))
    } catch (e) {
      errors.push({ item_id: sale.item_id, error: e instanceof Error ? e.message : 'Charge failed' })
    }
  }
  return results
}

const splitRows = (list: Array<Sale | { item_id: string; error: string }> | null, errors: { item_id?: string; error: string }[]) => {
  const sales: Sale[] = []
  for (const row of list ?? []) {
    if ('error' in row && !('sale_id' in row)) errors.push({ item_id: row.item_id, error: row.error })
    else sales.push(row as Sale)
  }
  return sales
}

// -------------------------------------------------------------
// The routes
// -------------------------------------------------------------
type Handler = (req: Request, body: Record<string, unknown>) => Promise<Response>

const routes: Record<string, Handler> = {
  async register(_req, body) {
    const name = str(body.name, 80)
    const email = str(body.email, 120).toLowerCase()
    const phone = str(body.phone, 30)
    const fulfil = body.fulfil === 'ship' ? 'ship' : 'pickup'
    const event = str(body.event, 60) || 'midwest-bunfest-2026'
    const address = fulfil === 'ship' ? pickAddress(body.address) : null
    const cardToken = str(body.card_token, 500)
    if (!name) throw new HttpError(400, 'Please give your name.')
    if (!email.includes('@')) throw new HttpError(400, 'Please give an email address.')
    if (fulfil === 'ship' && (!address?.line1 || !address.zip)) throw new HttpError(400, 'Please give a shipping address.')
    if (!cardToken) throw new HttpError(400, 'Please enter a card.')
    const settings = await settingsFor(event)
    squareFor(settings) // set up? (before a bidder record is made)
    const bidder = await rpc<Bidder>(db, 'auction_register_bidder', {
      p_event: event, p_name: name, p_email: email, p_phone: phone || null, p_fulfil: fulfil, p_address: address,
    })
    try {
      return json({ bidder: publicBidder(await saveCard(settings, bidder, cardToken)) })
    } catch (e) {
      // Registered, but the card didn't save: the bidder tries another card with new-card.
      if (e instanceof HttpError) throw new HttpError(e.status, e.message, { bidder: publicBidder(bidder) })
      throw e
    }
  },

  async 'new-card'(_req, body) {
    const bidder = await bidderByToken(body.token)
    const cardToken = str(body.card_token, 500)
    if (!cardToken) throw new HttpError(400, 'Please enter a card.')
    if (!(await rpc<boolean>(db, 'auction_card_attempt', { p_bidder_id: bidder.id }))) {
      throw new HttpError(429, 'That is a lot of cards in one hour. Please try again later, or contact OHRR.')
    }
    return json({ bidder: publicBidder(await saveCard(await settingsFor(bidder.event_slug), bidder, cardToken)) })
  },

  async 'buy-now'(_req, body) {
    const bidder = await bidderByToken(body.token)
    if (!isUuid(body.item_id)) throw new HttpError(400, 'Which item?')
    if (bidder.is_blocked) throw new HttpError(403, 'Bidding is not available for this registration. Please contact OHRR.')
    if (!bidder.card_ready) throw new HttpError(400, 'Please add a card first.')
    const { data: item } = await db.from('raffle_items').select('event_slug').eq('id', body.item_id).maybeSingle()
    if (!item) throw new HttpError(404, 'That item is not in the auction.')
    if (item.event_slug !== bidder.event_slug) throw new HttpError(400, 'That item is in another auction. Please register for that auction to buy it.')
    // Locks the item and marks it sold-pending, so two people can't both buy it.
    const sale = await rpc<Sale>(db, 'auction_begin_sale', { p_item_id: body.item_id, p_bidder_id: bidder.id, p_kind: 'buy_now' })
    const result = await chargeSale(sale, 'void')
    return json(result, result.ok ? 200 : 402)
  },

  async pay(_req, body) {
    const bidder = await bidderByToken(body.token)
    if (!isUuid(body.sale_id)) throw new HttpError(400, 'Missing details.')
    if (!bidder.card_ready) throw new HttpError(400, 'Please add a card first.')
    const sale = await rpc<Sale | null>(db, 'auction_sale_get', { p_sale_id: body.sale_id })
    if (!sale || sale.bidder_id !== bidder.id) throw new HttpError(403, 'That sale is not yours.')
    if (sale.payment_status !== 'pending' && sale.payment_status !== 'failed') throw new HttpError(400, `This sale is already ${sale.payment_status}.`)
    // chargeSale charges the card the bidder has now (they may have just changed it).
    const result = await chargeSale(sale, 'failed')
    return json(result, result.ok ? 200 : 402)
  },

  async charge(req, body) {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) throw new HttpError(401, 'Sign in as staff first.')
    const staff = userClient(jwt)
    const errors: { item_id?: string; error: string }[] = []
    let sales: Sale[] = []
    if (isUuid(body.sale_id)) {
      // Staff can read the sales they manage (Row-Level Security); anyone else gets nothing.
      const { data, error } = await staff.from('auction_sales').select('id').eq('id', body.sale_id).maybeSingle()
      if (error || !data) throw new HttpError(403, 'Not allowed.')
      const sale = await rpc<Sale | null>(db, 'auction_sale_get', { p_sale_id: body.sale_id })
      if (sale) sales = [sale]
    } else if (isUuid(body.offer_next_sale_id)) {
      const next = await rpc<Sale | null>(staff, 'auction_offer_next', { p_sale_id: body.offer_next_sale_id })
      if (!next) return json({ results: [], errors: [], message: 'No other bidder with a card on file bid on this item.' })
      sales = [next]
    } else {
      if (!isUuid(body.org_id)) throw new HttpError(400, 'Missing org_id.')
      const list = await rpc<Array<Sale | { item_id: string; error: string }>>(staff, 'auction_close_ready', {
        p_org: body.org_id,
        p_event: str(body.event, 60) || 'midwest-bunfest-2026',
      })
      sales = splitRows(list, errors)
    }
    return json({ results: await chargeAll(sales, errors), errors })
  },

  async locations(req, body) {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) throw new HttpError(401, 'Sign in as staff first.')
    const event = str(body.event, 60) || 'midwest-bunfest-2026'
    const settings = await settingsFor(event)
    const { data: allowed } = await userClient(jwt).rpc('has_permission', { p_org: settings.org_id, p_key: 'events.bunfest.manage' })
    if (allowed !== true) throw new HttpError(403, 'Not allowed.')
    const appId = str(body.application_id, 80) || settings.square_application_id
    const sq = squareFor({ ...settings, square_application_id: appId, square_location_id: settings.square_location_id ?? 'pending' })
    const r = await sq.call<{ locations?: Array<{ id: string; name?: string; status?: string; currency?: string }> }>('GET', '/v2/locations')
    if (!r.ok) throw new HttpError(400, squareMessage(r.data.errors, 'Square did not answer. Check the access token.'))
    return json({ locations: (r.data.locations ?? []).map((l) => ({ id: l.id, name: l.name ?? l.id, active: l.status === 'ACTIVE', currency: l.currency ?? null })) })
  },
}

async function closeDue(req: Request): Promise<Response> {
  const { data: cfg } = await db.from('push_config').select('trigger_secret').eq('id', 1).single()
  if (!cfg || req.headers.get('x-ohrr-secret') !== cfg.trigger_secret) return json({ error: 'not allowed' }, 401)
  const errors: { item_id?: string; error: string }[] = []
  const sales = splitRows(await rpc(db, 'auction_close_due'), errors)
  const stuck = splitRows(await rpc(db, 'auction_claim_stuck_sales', { p_limit: 20 }), errors)
  const results = await chargeAll([...sales, ...stuck], errors)
  return json({ charged: results.filter((r) => r.ok).length, declined: results.filter((r) => !r.ok).length, errors })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const headers = cors(origin)
  if (req.method === 'OPTIONS') return new Response(null, { status: origin && originAllowed(origin) ? 204 : 403, headers })
  if (origin && !originAllowed(origin)) return json({ error: 'This site may not use the auction payments.' }, 403)
  const route = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop() ?? ''
  try {
    if (route === 'health') {
      const live = Boolean(Deno.env.get('SQUARE_ACCESS_TOKEN'))
      const sandbox = Boolean(Deno.env.get('SQUARE_SANDBOX_ACCESS_TOKEN'))
      return json({ ok: true, provider: 'square', square: live || sandbox, square_live: live, square_sandbox: sandbox, supabase: Boolean(SERVICE_KEY) }, 200, headers)
    }
    if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405, headers)
    if (route === 'close-due') return await closeDue(req)
    const handler = routes[route]
    if (!handler) return json({ error: 'Not found.' }, 404, headers)
    let body: Record<string, unknown> = {}
    try {
      const v = await req.json()
      if (v && typeof v === 'object') body = v as Record<string, unknown>
    } catch {
      throw new HttpError(400, 'Send JSON.')
    }
    const res = await handler(req, body)
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v)
    return res
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, ...e.extra }, e.status, headers)
    console.error(e)
    return json({ error: 'Something went wrong on our side. Please try again in a moment.' }, 500, headers)
  }
})
