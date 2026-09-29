// The bidding box on one auction item: the running bid, the next minimum, the
// close time, and — for a registered bidder while the item is open — the bid
// form and Buy Now. Under it, the bid history (amounts and bidder numbers).
//
// Money moves only through the payment server (auctionApi) and Stripe; this
// file never sees a card. Every message here is written for the bidder.
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Card, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { staffInput } from '../../components/staffui'
import {
  auctionApi,
  closesIn,
  dollarsToCents,
  fetchItemBids,
  fmtWhen,
  money,
  placeBid,
  shippingFor,
  whyClosed,
  type AuctionItem,
  type AuctionSettings,
  type BidRow,
} from './client'
import { shipLine, useMyPage, useRememberedBidder } from './useAuction'

export function BidBox({
  item,
  settings,
  now,
  onChanged,
}: {
  item: AuctionItem
  settings: AuctionSettings | null
  now: string
  onChanged: () => Promise<void> | void
}) {
  const me = useRememberedBidder()
  const token = me?.access_token ?? null
  // Who they are (pickup or shipping, card ready) — read once, not polled.
  const { page } = useMyPage(token, { poll: false })
  const bidder = page?.bidder ?? null

  const closed = whyClosed(item, settings, now)
  const registerTo = `/bunfest/auction/register?next=${encodeURIComponent(`/bunfest/auction/${item.id}`)}`

  return (
    <div className="space-y-3">
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              {item.status === 'won' ? 'Sold' : item.current_bid_cents != null ? 'Current bid' : 'Starting bid'}
            </p>
            <p className="font-display text-3xl font-black text-ink">
              {item.status === 'won'
                ? money(item.current_bid_cents) || '—'
                : money(item.current_bid_cents ?? item.starting_bid_cents ?? item.next_min_cents)}
            </p>
          </div>
          <div className="text-right text-xs font-semibold text-slate-500">
            <p>
              {item.bid_count} bid{item.bid_count === 1 ? '' : 's'}
            </p>
            {item.high_bidder_no != null && item.status !== 'won' && (
              <p className={me && me.bidder_no === item.high_bidder_no ? 'text-emerald-700' : ''}>
                {me && me.bidder_no === item.high_bidder_no ? 'You are high' : `Bidder #${item.high_bidder_no} is high`}
              </p>
            )}
            {item.status === 'won' && item.won_kind === 'buy_now' && <p>Buy Now</p>}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
          {item.status !== 'won' && (
            <>
              <dt className="text-slate-500">Next bid at least</dt>
              <dd className="text-right font-bold text-ink">{money(item.next_min_cents)}</dd>
            </>
          )}
          {item.buy_now_cents != null && item.status !== 'won' && (
            <>
              <dt className="text-slate-500">Buy now</dt>
              <dd className="text-right font-bold text-ink">{money(item.buy_now_cents)}</dd>
            </>
          )}
          <dt className="text-slate-500">Shipping</dt>
          <dd className="text-right font-bold text-ink">{shipLine(item)}</dd>
          {item.closes_at && (
            <>
              <dt className="text-slate-500">{item.is_open ? 'Closes' : 'Closed'}</dt>
              <dd className="text-right font-bold text-ink">
                {fmtWhen(item.closes_at)}
                {item.is_open && <span className="block text-xs font-semibold text-brand-orange-dark">{closesIn(item.closes_at, now)}</span>}
              </dd>
            </>
          )}
        </dl>

        {closed ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600">{closed}</p>
        ) : !me ? (
          <div className="space-y-2 pt-1">
            <Link to={registerTo} className={`${btn.primary} min-h-[48px] w-full`}>
              <Icon name="gavel" size={18} /> Register to bid
            </Link>
            <p className="text-center text-xs leading-relaxed text-slate-500">
              Name, email and a card. You’re only charged if you win or use Buy now.
            </p>
          </div>
        ) : page === undefined ? (
          <p className="text-sm text-slate-500">Checking your registration…</p>
        ) : !bidder ? (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-slate-600">We couldn’t find your registration on this device any more.</p>
            <Link to={registerTo} className={`${btn.primary} min-h-[48px] w-full`}>
              Register to bid
            </Link>
          </div>
        ) : bidder.is_blocked ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600">
            Bidding is not available for this registration. Please see the auction desk.
          </p>
        ) : !bidder.card_ready ? (
          <div className="space-y-2 pt-1">
            <p className="text-sm text-slate-600">Add a card before bidding — it’s charged only if you win.</p>
            <Link to="/bunfest/auction/me" className={`${btn.primary} min-h-[48px] w-full`}>
              Add a card
            </Link>
          </div>
        ) : (
          <BidForm
            item={item}
            token={token!}
            bidder={bidder}
            publishableKey={settings?.stripe_publishable_key ?? null}
            onChanged={onChanged}
          />
        )}
      </Card>

      <BidHistory item={item} myNo={me?.bidder_no ?? null} />
    </div>
  )
}

/* ------------------------------------------------------------------ form */
function BidForm({
  item,
  token,
  bidder,
  publishableKey,
  onChanged,
}: {
  item: AuctionItem
  token: string
  bidder: { fulfil: 'pickup' | 'ship' }
  publishableKey: string | null
  onChanged: () => Promise<void> | void
}) {
  const [amount, setAmount] = useState(() => String(item.next_min_cents / 100))
  const [busy, setBusy] = useState<'bid' | 'buy' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [confirmBuy, setConfirmBuy] = useState(false)
  const [bought, setBought] = useState(false)

  // Someone else bid: lift the box to the new minimum unless they typed more.
  useEffect(() => {
    const typed = dollarsToCents(amount) ?? 0
    if (typed < item.next_min_cents) setAmount(String(item.next_min_cents / 100))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.next_min_cents])

  const quick = useMemo(
    () => [
      { label: 'Minimum', cents: item.next_min_cents },
      { label: '2 steps', cents: item.next_min_cents + item.increment_cents },
      { label: '5 steps', cents: item.next_min_cents + 4 * item.increment_cents },
    ].filter((q) => item.buy_now_cents == null || q.cents < item.buy_now_cents),
    [item.next_min_cents, item.increment_cents, item.buy_now_cents],
  )

  const bid = async (e: FormEvent) => {
    e.preventDefault()
    const cents = dollarsToCents(amount)
    if (cents == null) {
      setError('Enter an amount in dollars.')
      return
    }
    setBusy('bid')
    setError(null)
    setDone(null)
    try {
      const r = await placeBid(supabase, token, item.id, cents)
      setDone(`You’re the high bidder at ${money(r.item.current_bid_cents)}.`)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The bid did not go through. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const ship = shippingFor(item, bidder)
  const total = (item.buy_now_cents ?? 0) + ship

  const buy = async () => {
    setBusy('buy')
    setError(null)
    setDone(null)
    try {
      const r = await auctionApi.buyNow(token, item.id)
      if (r.ok) {
        setBought(true)
      } else if (r.requires_action) {
        if (!publishableKey) throw new Error('Your bank asked for a check, but the auction is not set up to show it. Please see the auction desk.')
        // Stripe's script only loads when a bank actually asks (keeps it out of the main bundle).
        const { confirmPaymentAction } = await import('./CardSetup')
        const c = await confirmPaymentAction(publishableKey, r.client_secret)
        if (!c.ok) throw new Error(c.error ?? 'The bank did not approve the payment.')
        const fin = await auctionApi.complete(token, r.sale.sale_id)
        if (fin.sale.payment_status === 'paid') setBought(true)
        else throw new Error(fin.sale.failure_message ?? 'The payment was not completed. The item is back on sale.')
      } else {
        throw new Error(r.error || 'The payment did not go through. The item is back on sale.')
      }
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The payment did not go through.')
    } finally {
      setBusy(null)
      setConfirmBuy(false)
    }
  }

  if (bought) {
    return (
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status" aria-live="polite">
        <p className="font-display text-lg font-extrabold text-emerald-800">It’s yours.</p>
        <p className="text-sm text-emerald-900">
          {money(total)} on your card. Stripe emails the receipt.{' '}
          {bidder.fulfil === 'ship' && item.ship_fee_cents != null ? 'We’ll ship it to you.' : 'Pick it up at the auction table.'}
        </p>
        <Link to="/bunfest/auction/me" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-blue">
          Your bids and wins <Icon name="chevron" size={16} />
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={bid} className="space-y-3 border-t border-slate-100 pt-3">
      <label className="block text-sm font-semibold text-slate-700">
        Your bid ($)
        <input
          className={`${staffInput} text-lg font-bold`}
          type="number"
          inputMode="decimal"
          min={item.next_min_cents / 100}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy != null}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={busy != null}
            onClick={() => setAmount(String(q.cents / 100))}
            className="inline-flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-60"
          >
            {money(q.cents)}
            <span className="text-[11px] font-semibold text-slate-400">{q.label}</span>
          </button>
        ))}
      </div>
      <button type="submit" disabled={busy != null} className={`${btn.primary} min-h-[52px] w-full text-base disabled:opacity-60`}>
        <Icon name="gavel" size={18} /> {busy === 'bid' ? 'Placing your bid…' : 'Place bid'}
      </button>

      {item.buy_now_cents != null &&
        (confirmBuy ? (
          <div className="space-y-2 rounded-xl border border-brand-orange/40 bg-brand-orange-50/60 px-4 py-3">
            <p className="font-display text-base font-extrabold text-ink">Buy now for {money(total)}?</p>
            <p className="text-sm text-slate-700">
              {money(item.buy_now_cents)}
              {ship > 0 && <> + {money(ship)} shipping</>} on your saved card, charged now. Bidding on this item ends.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void buy()} disabled={busy != null} className={`${btn.primary} min-h-[48px] flex-1 disabled:opacity-60`}>
                {busy === 'buy' ? 'Charging your card…' : `Yes — pay ${money(total)}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmBuy(false)}
                disabled={busy != null}
                className="min-h-[48px] rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                Not now
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmBuy(true)} disabled={busy != null} className={`${btn.blue} min-h-[48px] w-full disabled:opacity-60`}>
            Buy now for {money(item.buy_now_cents)}
          </button>
        ))}

      <div aria-live="polite">
        {done && <p className="text-sm font-bold text-emerald-700">{done}</p>}
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
      </div>
    </form>
  )
}

/* --------------------------------------------------------------- history */
function BidHistory({ item, myNo }: { item: AuctionItem; myNo: number | null }) {
  const [bids, setBids] = useState<BidRow[] | null>(null)
  // Reload when the running bid moves (the item is polled every 15 s).
  useEffect(() => {
    let alive = true
    fetchItemBids(supabase, item.id)
      .then((b) => alive && setBids(b ?? []))
      .catch(() => alive && setBids([]))
    return () => {
      alive = false
    }
  }, [item.id, item.bid_count, item.current_bid_cents, item.status])

  if (!bids || bids.length === 0) return null
  return (
    <Card>
      <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-slate-400">Bids</h2>
      <ul className="mt-2 divide-y divide-slate-100">
        {bids.map((b, i) => {
          const mine = myNo != null && b.bidder_no === myNo
          return (
            <li key={`${b.at}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className={`font-bold ${b.is_high ? 'text-ink' : 'text-slate-500'}`}>
                {money(b.amount_cents)}
                {b.kind === 'buy_now' && <span className="ml-1.5 text-xs font-semibold text-slate-400">Buy Now</span>}
                {b.kind === 'desk' && <span className="ml-1.5 text-xs font-semibold text-slate-400">at the table</span>}
              </span>
              <span className="min-w-0 truncate text-slate-500">
                {b.bidder_no != null ? (mine ? 'you' : `Bidder #${b.bidder_no}`) : '—'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{fmtWhen(b.at)}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
