// /bunfest/auction/me — the bidder's own page: who they are, the card on
// file, their bids (high or outbid) and their wins (what they owe, how it
// was paid, pickup or shipping). /bunfest/auction/me/:token is the same page
// opened from a link on any device; that device then remembers the bidder.
// Polled every 15 s so an outbid shows up on its own.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { PageHeader, Screen, Card, Badge, btn, QuietNote } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { staffInput } from '../../../components/staffui'
import {
  auctionApi,
  bidLine,
  closesIn,
  fmtWhen,
  forgetBidder,
  money,
  updateBidder,
  FULFIL_LABEL,
  PAYMENT_LABEL,
  type Address,
  type AuctionSettings,
  type Bidder,
  type Fulfil,
  type MyBid,
  type MyPage,
  type Sale,
} from '../client'
import CardSetup, { confirmPaymentAction } from '../CardSetup'
import { useMyPage, useRememberedBidder } from '../useAuction'

export default function MyBids() {
  const { token: linkToken } = useParams()
  const me = useRememberedBidder()
  const token = linkToken ?? me?.access_token ?? null
  const { page, error, refresh } = useMyPage(token, { poll: true, remember: Boolean(linkToken) })
  const navigate = useNavigate()

  const header = <PageHeader icon="gavel" title="Your bids" subtitle="Midwest BunFest Silent Auction" />

  if (!token) {
    return (
      <>
        {header}
        <Screen className="space-y-4">
          <Card className="space-y-2">
            <p className="font-display text-lg font-extrabold text-ink">You haven’t registered on this phone</p>
            <p className="text-sm leading-relaxed text-slate-600">
              Register once and your bids and wins show here. If you registered on another device, open the link in
              your registration email.
            </p>
            <Link to="/bunfest/auction/register?next=/bunfest/auction/me" className={`${btn.primary} min-h-[48px] w-full`}>
              Register to bid
            </Link>
          </Card>
          <BackToAuction />
        </Screen>
      </>
    )
  }

  if (page === undefined) {
    return (
      <>
        {header}
        <Screen>
          <div className="h-24 w-full animate-pulse rounded-2xl bg-slate-100" />
        </Screen>
      </>
    )
  }

  if (page === null) {
    return (
      <>
        {header}
        <Screen className="space-y-4">
          <Card className="space-y-2">
            <p className="font-display text-lg font-extrabold text-ink">We couldn’t find that registration</p>
            <p className="text-sm leading-relaxed text-slate-600">
              {error ?? 'The link may be old, or bidding for this event hasn’t been set up yet.'}
            </p>
            <Link to="/bunfest/auction/register?next=/bunfest/auction/me" className={`${btn.primary} min-h-[48px] w-full`}>
              Register to bid
            </Link>
          </Card>
          <BackToAuction />
        </Screen>
      </>
    )
  }

  const { bidder, settings, now } = page

  return (
    <>
      {header}
      <Screen className="space-y-5">
        <WhoYouAre bidder={bidder} token={token} settings={settings} onChanged={refresh} />
        <CardOnFile bidder={bidder} token={token} settings={settings} onChanged={refresh} />
        <Wins page={page} token={token} onChanged={refresh} />
        <Bids bids={page.bids} now={now} />
        {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <BackToAuction />
          <button
            type="button"
            onClick={() => {
              forgetBidder()
              navigate('/bunfest/auction/register?next=/bunfest/auction', { replace: true })
            }}
            className="block min-h-[44px] text-sm font-bold text-slate-500"
          >
            Not you? Register again
          </button>
        </div>
      </Screen>
    </>
  )
}

function BackToAuction() {
  return (
    <Link to="/bunfest/auction" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue hover:text-brand-blue-dark">
      <Icon name="arrowLeft" size={16} /> All auction items
    </Link>
  )
}

/* ------------------------------------------------------------- who you are */
function WhoYouAre({
  bidder,
  token,
  settings,
  onChanged,
}: {
  bidder: Bidder
  token: string
  settings: AuctionSettings | null
  onChanged: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(bidder.name)
  const [phone, setPhone] = useState(bidder.phone ?? '')
  const [fulfil, setFulfil] = useState<Fulfil>(bidder.fulfil)
  const [addr, setAddr] = useState<Address>({ line1: '', line2: '', city: '', state: 'OH', zip: '', ...(bidder.address ?? {}) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateBidder(supabase, token, { name: name.trim(), phone: phone.trim(), fulfil, address: fulfil === 'ship' ? addr : null })
      await onChanged()
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save that.')
    } finally {
      setBusy(false)
    }
  }

  const a = bidder.address
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Bidder</p>
          <p className="font-display text-2xl font-black text-ink">#{bidder.bidder_no}</p>
        </div>
        {bidder.is_blocked && <Badge tone="slate">See the auction desk</Badge>}
      </div>
      {editing ? (
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm font-semibold text-slate-700">
            Name
            <input className={staffInput} required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Phone (optional)
            <input className={staffInput} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['pickup', 'ship'] as const).map((f) => (
              <label
                key={f}
                className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold ${
                  fulfil === f ? 'border-brand-blue bg-brand-blue-50 text-brand-blue' : 'border-slate-200 text-slate-600'
                }`}
              >
                <input type="radio" name="fulfil" className="sr-only" checked={fulfil === f} onChange={() => setFulfil(f)} />
                {f === 'pickup' ? 'Pick up at BunFest' : 'Ship it to me'}
              </label>
            ))}
          </div>
          {fulfil === 'ship' && (
            <div className="space-y-3">
              {settings?.shipping_note && <QuietNote>{settings.shipping_note}</QuietNote>}
              <label className="block text-sm font-semibold text-slate-700">
                Street address
                <input className={staffInput} required value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Apartment, unit (optional)
                <input className={staffInput} value={addr.line2 ?? ''} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1 text-sm font-semibold text-slate-700">
                  City
                  <input className={staffInput} required value={addr.city ?? ''} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
                </label>
                <label className="block w-20 text-sm font-semibold text-slate-700">
                  State
                  <input className={staffInput} maxLength={2} value={addr.state ?? ''} onChange={(e) => setAddr({ ...addr, state: e.target.value.toUpperCase() })} />
                </label>
                <label className="block w-28 text-sm font-semibold text-slate-700">
                  ZIP
                  <input className={staffInput} required inputMode="numeric" value={addr.zip ?? ''} onChange={(e) => setAddr({ ...addr, zip: e.target.value })} />
                </label>
              </div>
            </div>
          )}
          {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={`${btn.primary} min-h-[48px] flex-1 disabled:opacity-60`}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" disabled={busy} onClick={() => setEditing(false)} className="min-h-[48px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="text-sm text-slate-700">
            <p className="font-bold text-ink">{bidder.name}</p>
            <p className="break-all">{bidder.email}</p>
            {bidder.phone && <p>{bidder.phone}</p>}
            <p className="mt-1.5">
              {bidder.fulfil === 'ship' ? (
                <>
                  Ship to: {[a?.line1, a?.line2, [a?.city, a?.state].filter(Boolean).join(', '), a?.zip].filter(Boolean).join(', ')}
                </>
              ) : (
                'Pick up at BunFest'
              )}
            </p>
            {bidder.fulfil === 'pickup' && settings?.pickup_note && <p className="mt-1 text-xs text-slate-500">{settings.pickup_note}</p>}
          </div>
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-blue">
            Change
          </button>
        </>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------ card on file */
function CardOnFile({
  bidder,
  token,
  settings,
  onChanged,
}: {
  bidder: Bidder
  token: string
  settings: AuctionSettings | null
  onChanged: () => Promise<void>
}) {
  const [secret, setSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pk = settings?.stripe_publishable_key ?? null

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await auctionApi.newCard(token)
      setSecret(r.client_secret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not start the card form.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Card on file</p>
      {bidder.card_ready ? (
        <p className="text-sm font-bold text-ink">
          {(bidder.card_brand ?? 'Card').replace(/^\w/, (c) => c.toUpperCase())} ending {bidder.card_last4 ?? '····'}
        </p>
      ) : (
        <p className="text-sm text-slate-600">No card yet — add one to bid.</p>
      )}
      <p className="text-xs text-slate-500">Held by Stripe. Charged only if you win or use Buy now.</p>
      {secret && pk ? (
        <CardSetup
          publishableKey={pk}
          clientSecret={secret}
          buttonClassName={`${btn.primary} min-h-[48px] w-full disabled:opacity-60`}
          label="Save this card"
          onSaved={async (id) => {
            await auctionApi.cardSaved(token, id)
            setSecret(null)
            await onChanged()
          }}
        />
      ) : (
        <button type="button" onClick={() => void start()} disabled={busy || !pk} className={`${btn.outline} min-h-[44px] disabled:opacity-60`}>
          {busy ? 'One moment…' : bidder.card_ready ? 'Change card' : 'Add a card'}
        </button>
      )}
      {!pk && <p className="text-xs text-slate-500">Card changes open once online bidding is switched on.</p>}
      {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
    </Card>
  )
}

/* ------------------------------------------------------------------- wins */
function Wins({ page, token, onChanged }: { page: MyPage; token: string; onChanged: () => Promise<void> }) {
  const { won, settings } = page
  return (
    <section className="space-y-2.5">
      <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">Your wins</p>
      {won.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">Nothing won yet. Items you win or Buy now show here with the receipt and pickup details.</p>
        </Card>
      ) : (
        won.map((s) => <WinCard key={s.sale_id} sale={s} token={token} settings={settings} onChanged={onChanged} />)
      )}
    </section>
  )
}

function WinCard({ sale, token, settings, onChanged }: { sale: Sale; token: string; settings: AuctionSettings | null; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pk = settings?.stripe_publishable_key ?? null

  const pay = async () => {
    setBusy(true)
    setError(null)
    try {
      const r = await auctionApi.pay(token, sale.sale_id)
      if (r.ok) {
        /* paid */
      } else if (r.requires_action) {
        if (!pk) throw new Error('Your bank asked for a check we cannot show here. Please see the auction desk.')
        const c = await confirmPaymentAction(pk, r.client_secret)
        if (!c.ok) throw new Error(c.error ?? 'The bank did not approve the payment.')
        const fin = await auctionApi.complete(token, sale.sale_id)
        if (fin.sale.payment_status !== 'paid') throw new Error(fin.sale.failure_message ?? 'The payment was not completed.')
      } else {
        throw new Error(r.error || 'The payment did not go through.')
      }
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment did not go through.')
    } finally {
      setBusy(false)
    }
  }

  const tone = sale.payment_status === 'paid' || sale.payment_status === 'cash' ? 'blue' : sale.payment_status === 'failed' ? 'orange' : 'slate'
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/bunfest/auction/${sale.item_id}`} className="min-w-0 font-display text-base font-extrabold text-ink hover:text-brand-blue">
          {sale.item?.title ?? 'Auction item'}
        </Link>
        <Badge tone={tone}>{PAYMENT_LABEL[sale.payment_status]}</Badge>
      </div>
      <p className="text-sm text-slate-700">
        {money(sale.amount_cents)}
        {sale.ship_fee_cents > 0 && <> + {money(sale.ship_fee_cents)} shipping</>}
        {sale.ship_fee_cents > 0 && <> = <span className="font-bold text-ink">{money(sale.total_cents)}</span></>}
        {sale.kind === 'buy_now' && <span className="ml-1.5 text-xs font-semibold text-slate-400">Buy Now</span>}
      </p>
      {sale.payment_status === 'paid' && <p className="text-xs text-slate-500">Receipt sent by email by Stripe.</p>}
      {sale.payment_status === 'failed' && (
        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-sm text-amber-900">{sale.failure_message ?? 'The card was declined.'}</p>
          <button type="button" onClick={() => void pay()} disabled={busy} className={`${btn.primary} min-h-[48px] w-full disabled:opacity-60`}>
            {busy ? 'Charging…' : `Pay now · ${money(sale.total_cents)}`}
          </button>
          <p className="text-xs text-amber-900/80">Uses the card on file above — change it first if you need to.</p>
        </div>
      )}
      {sale.payment_status === 'pending' && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Your card will be charged when the auction desk closes this item.</p>
          <button type="button" onClick={() => void pay()} disabled={busy} className={`${btn.outline} min-h-[44px] disabled:opacity-60`}>
            {busy ? 'Charging…' : 'Pay now'}
          </button>
        </div>
      )}
      {(sale.payment_status === 'paid' || sale.payment_status === 'cash') && (
        <p className="text-sm text-slate-700">
          {sale.fulfil === 'ship' ? (
            <>
              Shipping: <span className="font-bold">{FULFIL_LABEL[sale.fulfil_status]}</span>
              {sale.tracking && <> · tracking {sale.tracking}</>}
            </>
          ) : (
            <>
              Pickup: <span className="font-bold">{FULFIL_LABEL[sale.fulfil_status]}</span>
              {settings?.pickup_note && <span className="block text-xs text-slate-500">{settings.pickup_note}</span>}
            </>
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------- bids */
function Bids({ bids, now }: { bids: MyBid[]; now: string }) {
  // One row per item: the latest bid on it.
  const seen = new Set<string>()
  const rows = bids.filter((b) => {
    if (seen.has(b.item.id)) return false
    seen.add(b.item.id)
    return true
  })
  return (
    <section className="space-y-2.5">
      <p className="px-1 text-xs font-extrabold uppercase tracking-wider text-slate-400">Your bids</p>
      {rows.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No bids yet. Open an item and tap “Place bid”.</p>
        </Card>
      ) : (
        rows.map((b) => {
          const item = b.item
          const sold = item.status === 'won'
          const high = b.is_high && !sold
          return (
            <Link key={b.bid_id} to={`/bunfest/auction/${item.id}`} className="block">
              <Card className="flex items-center gap-3 transition hover:border-slate-300">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-extrabold text-ink">{item.title}</p>
                  <p className="text-sm text-slate-600">
                    Your bid {money(b.amount_cents)} · {bidLine(item)}
                  </p>
                  {item.is_open && <p className="text-xs font-semibold text-slate-500">{closesIn(item.closes_at, now)} · {fmtWhen(item.closes_at)}</p>}
                </div>
                <Badge tone={high ? 'blue' : 'orange'}>{sold ? (b.is_high ? 'Won' : 'Sold') : high ? 'High bidder' : 'Outbid'}</Badge>
                <Icon name="chevron" size={18} className="shrink-0 text-slate-300" />
              </Card>
            </Link>
          )
        })
      )}
    </section>
  )
}
