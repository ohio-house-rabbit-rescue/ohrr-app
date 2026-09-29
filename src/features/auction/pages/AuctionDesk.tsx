// Staff → Auction desk: the Silent Auction on BunFest day and the days after.
//   Totals   — paid, pending, declined, sold, to pick up, to ship
//   Close & charge now — every item whose time has passed: start a sale for
//              its high bidder and charge the card on file (payment server)
//   Items    — each item, its high bidder (name, number, phone, email), the
//              sale and its state; walk-up sales, retries, pass to the next
//              bidder, paid at the desk, cancel, picked up, shipped, refund
//   Bidders  — everyone registered; block / unblock
// Data: auction_desk() (update 35), refreshed every 20 s and after each action.
// Money moves only through the payment server (auctionApi.charge) and Stripe.
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { errMessage, supabase } from '../../../lib/supabase'
import { Screen, Card, Badge, btn, QuietNote } from '../../../components/ui'
import { Icon } from '../../../components/icons'
import { Spinner, staffInput } from '../../../components/staffui'
import { AUCTION_EVENT_SLUG } from '../../raffle/types'
import {
  auctionApi,
  closesIn,
  dollarsToCents,
  fmtWhen,
  money,
  sessionLabel,
  FULFIL_LABEL,
  PAYMENT_LABEL,
  type AuctionItem,
  type AuctionSettings,
  type Bidder,
  type ChargeResult,
  type Fulfil,
  type PaymentStatus,
  type Sale,
} from '../client'

const DESK_POLL_MS = 20_000

interface DeskItem extends AuctionItem {
  is_published: boolean
  high_bidder: { id: string; name: string; email: string; phone: string | null; bidder_no: number; fulfil: Fulfil } | null
  bids: { amount_cents: number; kind: string; at: string; is_high: boolean; bidder_no: number | null; name: string | null }[]
  sale: Sale | null
}
interface DeskBidder extends Omit<Bidder, 'access_token'> {
  bids: number
  won: number
}
interface DeskData {
  now: string
  settings: AuctionSettings | null
  items: DeskItem[]
  bidders: DeskBidder[]
  totals: { paid_cents: number; pending_cents: number; failed: number; sold: number; to_ship: number; to_pick_up: number }
}

type Tab = 'items' | 'bidders'
const pill = (active: boolean) => `min-h-[44px] flex-1 rounded-full text-sm font-bold ${active ? 'bg-brand-blue text-white' : 'border border-slate-200 bg-white text-slate-600'}`
const small = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60'
const danger = 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-red-200 px-4 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60'

async function staffJwt(): Promise<string> {
  const jwt = (await supabase.auth.getSession()).data.session?.access_token
  if (!jwt) throw new Error('Please sign in again.')
  return jwt
}

/** Was this error the database saying update 35 isn't there yet? */
function isMissingFunction(msg: string): boolean {
  return /could not find the function|does not exist|schema cache|PGRST202/i.test(msg)
}

export default function AuctionDesk() {
  const { membership, can } = useAuth()
  const orgId = membership?.orgId ?? ''
  const allowed = can('events.bunfest.manage')
  const [tab, setTab] = useState<Tab>('items')
  const [data, setData] = useState<DeskData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const refresh = useCallback(async () => {
    if (!orgId || !allowed) return
    const { data: d, error: e } = await supabase.rpc('auction_desk', { p_org: orgId, p_event: AUCTION_EVENT_SLUG })
    if (e) {
      setError(errMessage(e))
      return
    }
    setError(null)
    setData(d as unknown as DeskData)
  }, [orgId, allowed])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, DESK_POLL_MS)
    return () => clearInterval(t)
  }, [refresh])

  if (!allowed) {
    return (
      <Screen>
        <p className="text-sm text-slate-600">You don’t have access to the auction desk. An owner or admin can grant “Manage Midwest BunFest info”.</p>
      </Screen>
    )
  }

  return (
    <Screen className="space-y-4">
      <div className="pt-1">
        <h1 className="font-display text-2xl font-black text-ink">Auction desk</h1>
        <p className="mt-1 text-sm text-slate-600">
          Close bidding and charge cards, record table sales, hand items over. Prices and the bidding switch are in{' '}
          <Link to="/staff/raffle" className="font-bold text-brand-blue">
            Silent Auction → Auction setup
          </Link>
          .
        </p>
      </div>

      {error && !data && (
        <Card className="space-y-2 border-amber-200 bg-amber-50/60">
          <p className="font-display text-base font-extrabold text-ink">The desk isn’t ready yet</p>
          {isMissingFunction(error) ? (
            <p className="text-sm leading-relaxed text-slate-700">
              The database update for online bidding (update 35, <code>RUN-THIS-IN-SUPABASE.sql</code>) hasn’t been run. Until
              it is, the Silent Auction screen still marks items won by hand.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-slate-700">{error}</p>
          )}
          <button type="button" onClick={() => void refresh()} className={small}>
            Try again
          </button>
        </Card>
      )}
      {!error && !data && <Spinner label="Loading the desk…" />}

      {data && (
        <>
          <Totals t={data.totals} />
          <CloseAndCharge orgId={orgId} data={data} onDone={refresh} />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className={pill(tab === 'items')} onClick={() => setTab('items')}>
              Items · {data.items.length}
            </button>
            <button type="button" className={pill(tab === 'bidders')} onClick={() => setTab('bidders')}>
              Bidders · {data.bidders.length}
            </button>
          </div>
          <input
            className={`${staffInput} !mt-0`}
            placeholder={tab === 'items' ? 'Search items or bidders' : 'Search bidders'}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            inputMode="search"
          />
          {tab === 'items' && <ItemsTab data={data} q={q} onChange={refresh} />}
          {tab === 'bidders' && <BiddersTab bidders={data.bidders} q={q} onChange={refresh} />}
        </>
      )}
    </Screen>
  )
}

/* ---------------------------------------------------------------- totals */
function Totals({ t }: { t: DeskData['totals'] }) {
  const cells: { v: string | number; label: string; tone: string }[] = [
    { v: money(t.paid_cents) || '$0', label: 'paid', tone: 'text-emerald-700' },
    { v: money(t.pending_cents) || '$0', label: 'pending', tone: 'text-brand-orange' },
    { v: t.failed, label: 'declined', tone: t.failed ? 'text-red-600' : 'text-ink' },
    { v: t.sold, label: 'sold', tone: 'text-brand-blue' },
    { v: t.to_pick_up, label: 'to pick up', tone: 'text-ink' },
    { v: t.to_ship, label: 'to ship', tone: 'text-ink' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {cells.map((c) => (
        <Card key={c.label} className="!p-2">
          <p className={`font-display text-xl font-black ${c.tone}`}>{c.v}</p>
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
        </Card>
      ))}
    </div>
  )
}

/* -------------------------------------------------------- close & charge */
function describe(r: ChargeResult): { title: string; line: string; tone: 'ok' | 'bad' | 'wait' } {
  const who = r.sale.buyer?.name ? `${r.sale.buyer.name}${r.sale.buyer.bidder_no ? ` (#${r.sale.buyer.bidder_no})` : ''}` : 'the buyer'
  const title = `${r.sale.item?.title ?? 'Item'} · ${money(r.sale.total_cents)}`
  if (r.ok) return { title, line: `Paid — ${who}`, tone: 'ok' }
  if (r.requires_action) return { title, line: `${who}’s bank wants a check. Ask them to open Your bids and tap Pay now.`, tone: 'wait' }
  return { title, line: `Declined — ${who}: ${r.error}`, tone: 'bad' }
}

function ResultList({ res }: { res: { results: ChargeResult[]; errors: { item_id?: string; error: string }[]; message?: string } }) {
  if (res.results.length === 0 && res.errors.length === 0) {
    return <p className="text-sm text-slate-600">{res.message ?? 'Nothing to charge right now — no closed items with a high bidder.'}</p>
  }
  return (
    <ul className="space-y-1.5">
      {res.results.map((r, i) => {
        const d = describe(r)
        return (
          <li key={i} className={`rounded-xl px-3 py-2 text-sm ${d.tone === 'ok' ? 'bg-emerald-50 text-emerald-900' : d.tone === 'bad' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>
            <span className="font-bold">{d.title}</span>
            <span className="block">{d.line}</span>
          </li>
        )
      })}
      {res.errors.map((e, i) => (
        <li key={`e${i}`} className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {e.error}
        </li>
      ))}
      {res.message && <li className="text-xs text-slate-500">{res.message}</li>}
    </ul>
  )
}

function CloseAndCharge({ orgId, data, onDone }: { orgId: string; data: DeskData; onDone: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<{ results: ChargeResult[]; errors: { item_id?: string; error: string }[]; message?: string } | null>(null)

  const ready = data.items.filter(
    (i) => i.is_published && i.status === 'available' && i.high_bidder_no != null && i.closes_at && new Date(data.now) >= new Date(i.closes_at),
  )

  const go = async () => {
    setBusy(true)
    setError(null)
    setRes(null)
    try {
      const r = await auctionApi.charge(await staffJwt(), { org_id: orgId, event: AUCTION_EVENT_SLUG })
      setRes(r)
      await onDone()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-display text-base font-extrabold text-ink">Close &amp; charge</p>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
          Charges the high bidder of every item whose time has passed, on the card they saved. Declined cards show here so
          you can retry or pass the item to the next bidder.
          {ready.length > 0 ? ` ${ready.length} item${ready.length === 1 ? ' is' : 's are'} ready.` : ' Nothing is ready right now.'}
        </p>
      </div>
      {confirm ? (
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => void go()} className={`${btn.primary} min-h-[48px] flex-1 disabled:opacity-60`}>
            {busy ? 'Charging…' : `Yes — charge ${ready.length} card${ready.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirm(false)} className={small}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className={`${btn.primary} min-h-[48px] w-full`}>
          <Icon name="gavel" size={18} /> Close &amp; charge now
        </button>
      )}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {res && <ResultList res={res} />}
    </Card>
  )
}

/* ----------------------------------------------------------------- items */
function ItemsTab({ data, q, onChange }: { data: DeskData; q: string; onChange: () => Promise<void> }) {
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.items
    return data.items.filter((i) => {
      const hay = [i.title, i.high_bidder?.name, i.high_bidder?.email, i.high_bidder?.bidder_no != null ? `#${i.high_bidder.bidder_no}` : '', i.sale?.buyer?.name, i.sale?.buyer?.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [data.items, q])

  if (data.items.length === 0) return <p className="text-sm text-slate-500">No auction items yet. Add them in Silent Auction.</p>
  if (list.length === 0) return <p className="text-sm text-slate-500">Nothing matches.</p>
  return (
    <div className="space-y-3">
      {list.map((i) => (
        <ItemCard key={i.id} item={i} now={data.now} settings={data.settings} onChange={onChange} />
      ))}
    </div>
  )
}

function PayChip({ s }: { s: PaymentStatus }) {
  const cls =
    s === 'paid' || s === 'cash'
      ? 'bg-emerald-50 text-emerald-700'
      : s === 'failed'
        ? 'bg-red-50 text-red-700'
        : s === 'pending'
          ? 'bg-amber-50 text-amber-800'
          : 'bg-slate-100 text-slate-600'
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{PAYMENT_LABEL[s]}</span>
}

function ItemCard({ item, now, settings, onChange }: { item: DeskItem; now: string; settings: AuctionSettings | null; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [tableSale, setTableSale] = useState(false)
  const [tracking, setTracking] = useState('')
  const [showBids, setShowBids] = useState(false)
  const sale = item.sale
  const hb = item.high_bidder

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const n = await fn()
      if (n) setNote(n)
      await onChange()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const updateSale = (patch: { p_payment_status?: string; p_fulfil_status?: string; p_tracking?: string }) =>
    run(async () => {
      if (!sale) return
      const { error } = await supabase.rpc('auction_update_sale', { p_sale_id: sale.sale_id, ...patch })
      if (error) throw error
    })
  const chargeAgain = () =>
    run(async () => {
      if (!sale) return
      const r = await auctionApi.charge(await staffJwt(), { sale_id: sale.sale_id })
      const first = r.results[0]
      if (r.errors[0]) throw new Error(r.errors[0].error)
      return first ? describe(first).line : (r.message ?? 'Done')
    })
  const offerNext = () =>
    run(async () => {
      if (!sale) return
      const r = await auctionApi.charge(await staffJwt(), { offer_next_sale_id: sale.sale_id })
      const first = r.results[0]
      if (r.errors[0]) throw new Error(r.errors[0].error)
      return first ? `Offered to the next bidder. ${describe(first).line}` : (r.message ?? 'No other bidder with a card — the item is back on sale.')
    })

  const closed = item.closes_at ? new Date(now) >= new Date(item.closes_at) : false

  return (
    <Card className={`space-y-2.5 ${!item.is_published ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold text-ink">{item.title}</p>
          <p className="text-xs font-semibold text-slate-500">
            {sessionLabel(item.session)}
            {!item.is_published && ' · hidden'}
            {item.closes_at && <> · {closed ? `closed ${fmtWhen(item.closes_at)}` : `${closesIn(item.closes_at, now)} (${fmtWhen(item.closes_at)})`}</>}
          </p>
        </div>
        {sale ? <PayChip s={sale.payment_status} /> : item.status === 'won' ? <Badge tone="slate">Sold</Badge> : <Badge tone="blue">{item.is_open ? 'Open' : 'Available'}</Badge>}
      </div>

      <p className="text-sm text-slate-700">
        <span className="font-bold text-ink">{item.current_bid_cents != null ? money(item.current_bid_cents) : item.starting_bid_cents != null ? `starts ${money(item.starting_bid_cents)}` : 'no bids'}</span>
        {' · '}
        {item.bid_count} bid{item.bid_count === 1 ? '' : 's'}
        {item.buy_now_cents != null && <> · Buy now {money(item.buy_now_cents)}</>}
        {' · '}
        {item.ship_fee_cents == null ? 'pickup only' : `ships +${money(item.ship_fee_cents)}`}
      </p>

      {hb && !sale && (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <p className="font-bold text-ink">
            High bidder #{hb.bidder_no} · {hb.name}
          </p>
          <p className="break-all text-slate-600">
            {hb.email}
            {hb.phone && <> · {hb.phone}</>} · {hb.fulfil === 'ship' ? 'ships' : 'pickup'}
          </p>
        </div>
      )}

      {sale && (
        <div className="space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <p className="font-bold text-ink">
            {sale.kind === 'buy_now' ? 'Buy Now' : sale.kind === 'desk' ? 'Table sale' : 'Winning bid'} · {sale.buyer?.name ?? 'Walk-up'}
            {sale.buyer?.bidder_no != null && <> (#{sale.buyer.bidder_no})</>}
          </p>
          <p className="break-all text-slate-600">
            {[sale.buyer?.email, sale.buyer?.phone].filter(Boolean).join(' · ') || 'no contact given'}
          </p>
          <p className="text-slate-700">
            {money(sale.amount_cents)}
            {sale.ship_fee_cents > 0 && <> + {money(sale.ship_fee_cents)} shipping = <span className="font-bold text-ink">{money(sale.total_cents)}</span></>}
            {sale.buyer?.card_last4 && <> · card ending {sale.buyer.card_last4}</>}
          </p>
          <p className="text-slate-700">
            {sale.fulfil === 'ship' ? 'Shipping' : 'Pickup'}: <span className="font-bold">{FULFIL_LABEL[sale.fulfil_status]}</span>
            {sale.tracking && <> · {sale.tracking}</>}
          </p>
          {sale.fulfil === 'ship' && sale.ship_address && (
            <p className="text-xs text-slate-500">
              {[sale.ship_address.line1, sale.ship_address.line2, [sale.ship_address.city, sale.ship_address.state].filter(Boolean).join(', '), sale.ship_address.zip].filter(Boolean).join(', ')}
            </p>
          )}
          {sale.failure_message && <p className="text-red-700">{sale.failure_message}</p>}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!sale && item.status === 'available' && !tableSale && (
          <button type="button" disabled={busy} onClick={() => setTableSale(true)} className={`${btn.blue} min-h-[44px] !py-2 disabled:opacity-60`}>
            Record a table sale
          </button>
        )}
        {sale && (sale.payment_status === 'pending' || sale.payment_status === 'failed') && (
          <>
            {sale.bidder_id && (
              <button type="button" disabled={busy} onClick={() => void chargeAgain()} className={`${btn.primary} min-h-[44px] !py-2 disabled:opacity-60`}>
                Charge card again
              </button>
            )}
            {sale.kind !== 'desk' && (
              <button type="button" disabled={busy} onClick={() => window.confirm('Pass this item to the next-highest bidder with a card? This cancels the current sale.') && void offerNext()} className={small}>
                Offer to next bidder
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void updateSale({ p_payment_status: 'cash' })} className={small}>
              Paid at the desk
            </button>
            <button type="button" disabled={busy} onClick={() => window.confirm('Cancel this sale? The item goes back on sale and its bids are kept.') && void updateSale({ p_payment_status: 'void' })} className={danger}>
              Cancel sale
            </button>
          </>
        )}
        {sale && (sale.payment_status === 'paid' || sale.payment_status === 'cash') && (
          <>
            {sale.fulfil === 'pickup' && sale.fulfil_status !== 'picked_up' && (
              <button type="button" disabled={busy} onClick={() => void updateSale({ p_fulfil_status: 'picked_up' })} className={`${btn.primary} min-h-[44px] !py-2 disabled:opacity-60`}>
                <Icon name="check" size={16} /> Picked up
              </button>
            )}
            {sale.fulfil === 'ship' && sale.fulfil_status !== 'shipped' && (
              <div className="flex w-full gap-2">
                <input className={`${staffInput} !mt-0 flex-1`} placeholder="Tracking number (optional)" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                <button type="button" disabled={busy} onClick={() => void updateSale({ p_fulfil_status: 'shipped', p_tracking: tracking })} className={`${btn.primary} min-h-[44px] shrink-0 !py-2 disabled:opacity-60`}>
                  Shipped
                </button>
              </div>
            )}
            {sale.fulfil_status !== 'pending' && (
              <button type="button" disabled={busy} onClick={() => void updateSale({ p_fulfil_status: 'pending' })} className={small}>
                Undo {sale.fulfil_status === 'shipped' ? 'shipped' : 'picked up'}
              </button>
            )}
            {sale.payment_status === 'paid' && sale.stripe_payment_intent_id && (
              <>
                <a
                  href={`https://dashboard.stripe.com/payments/${encodeURIComponent(sale.stripe_payment_intent_id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={small}
                >
                  Refund in Stripe <Icon name="external" size={14} className="ml-1" />
                </a>
                <button type="button" disabled={busy} onClick={() => window.confirm('Mark this sale refunded? Do this after the refund is made in Stripe.') && void updateSale({ p_payment_status: 'refunded' })} className={danger}>
                  Mark refunded
                </button>
              </>
            )}
            {sale.payment_status === 'cash' && (
              <button type="button" disabled={busy} onClick={() => window.confirm('Cancel this sale? The item goes back on sale.') && void updateSale({ p_payment_status: 'void' })} className={danger}>
                Cancel sale
              </button>
            )}
          </>
        )}
        {sale && sale.payment_status === 'refunded' && (
          <button type="button" disabled={busy} onClick={() => window.confirm('Put this item back on sale?') && void updateSale({ p_payment_status: 'void' })} className={small}>
            Back on sale
          </button>
        )}
        {item.bids.length > 0 && (
          <button type="button" onClick={() => setShowBids((v) => !v)} className="inline-flex min-h-[44px] items-center px-2 text-sm font-bold text-brand-blue">
            {showBids ? 'Hide bids' : `Bids (${item.bids.length})`}
          </button>
        )}
      </div>

      {tableSale && (
        <TableSaleForm
          item={item}
          settings={settings}
          onDone={async () => {
            setTableSale(false)
            await onChange()
          }}
          onCancel={() => setTableSale(false)}
        />
      )}

      {showBids && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3 text-sm">
          {item.bids.map((b, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5">
              <span className={`font-bold ${b.is_high ? 'text-ink' : 'text-slate-500'}`}>{money(b.amount_cents)}</span>
              <span className="min-w-0 truncate text-slate-600">
                {b.bidder_no != null ? `#${b.bidder_no} ${b.name ?? ''}` : b.kind === 'desk' ? 'table' : '—'}
                {b.kind === 'buy_now' && ' · Buy Now'}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{fmtWhen(b.at)}</span>
            </li>
          ))}
        </ul>
      )}

      {note && <p className="text-sm font-semibold text-emerald-700">{note}</p>}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </Card>
  )
}

function TableSaleForm({ item, settings, onDone, onCancel }: { item: DeskItem; settings: AuctionSettings | null; onDone: () => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState(() => (item.current_bid_cents != null ? String(item.current_bid_cents / 100) : ''))
  const [fulfil, setFulfil] = useState<Fulfil>('pickup')
  const [paid, setPaid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const cents = dollarsToCents(amount)
    if (cents == null) {
      setError('Enter the amount.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase.rpc('auction_desk_sale', {
        p_item_id: item.id,
        p_name: name.trim() || 'Walk-up',
        p_phone: phone.trim() || null,
        p_email: email.trim() || null,
        p_amount_cents: cents,
        p_fulfil: fulfil,
        p_paid: paid,
        p_ship_fee_cents: fulfil === 'ship' ? (item.ship_fee_cents ?? 0) : null,
      })
      if (error) throw error
      await onDone()
    } catch (err) {
      setError(errMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-xl border border-brand-blue/20 bg-brand-blue-50/40 p-3">
      <p className="text-sm font-bold text-ink">Table sale — a paper bidder or walk-up</p>
      {item.high_bidder_no != null && (
        <QuietNote>
          Bidder #{item.high_bidder_no} is high online at {money(item.current_bid_cents)}. A table sale outbids them — make sure the table
          bid is higher.
        </QuietNote>
      )}
      <label className="block text-sm font-semibold text-slate-700">
        Amount ($)
        <input className={staffInput} type="number" inputMode="decimal" min="0" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Name
        <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-up" />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Phone
          <input className={staffInput} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="block flex-1 text-sm font-semibold text-slate-700">
          Email
          <input className={staffInput} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['pickup', 'ship'] as const).map((f) => (
          <label
            key={f}
            className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-bold ${
              fulfil === f ? 'border-brand-blue bg-white text-brand-blue' : 'border-slate-200 bg-white/60 text-slate-600'
            } ${f === 'ship' && item.ship_fee_cents == null ? 'opacity-50' : ''}`}
          >
            <input type="radio" className="sr-only" checked={fulfil === f} disabled={f === 'ship' && item.ship_fee_cents == null} onChange={() => setFulfil(f)} />
            {f === 'pickup' ? 'Pickup' : `Ship${item.ship_fee_cents != null ? ` (+${money(item.ship_fee_cents)})` : ''}`}
          </label>
        ))}
      </div>
      {fulfil === 'ship' && settings?.shipping_note && <p className="text-xs text-slate-500">{settings.shipping_note}</p>}
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="h-5 w-5 rounded border-slate-300" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
        Paid at the desk (cash or card reader)
      </label>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${btn.primary} min-h-[48px] flex-1 disabled:opacity-60`}>
          {busy ? 'Saving…' : 'Record sale'}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className={small}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/* --------------------------------------------------------------- bidders */
function BiddersTab({ bidders, q, onChange }: { bidders: DeskBidder[]; q: string; onChange: () => Promise<void> }) {
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return bidders
    return bidders.filter((b) => [b.name, b.email, b.phone, `#${b.bidder_no}`].filter(Boolean).join(' ').toLowerCase().includes(needle))
  }, [bidders, q])
  if (bidders.length === 0) return <p className="text-sm text-slate-500">Nobody has registered yet. Bidders appear here the moment they save a card.</p>
  if (list.length === 0) return <p className="text-sm text-slate-500">Nothing matches.</p>
  return (
    <div className="space-y-3">
      {list.map((b) => (
        <BidderCard key={b.id} b={b} onChange={onChange} />
      ))}
    </div>
  )
}

function BidderCard({ b, onChange }: { b: DeskBidder; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const a = b.address
  const toggle = async () => {
    if (!b.is_blocked && !window.confirm(`Block #${b.bidder_no} ${b.name} from bidding?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('auction_set_bidder_blocked', { p_bidder_id: b.id, p_blocked: !b.is_blocked })
    if (error) setError(errMessage(error))
    else await onChange()
    setBusy(false)
  }
  return (
    <Card className={`space-y-2 ${b.is_blocked ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold text-ink">
            #{b.bidder_no} · {b.name}
          </p>
          <p className="break-all text-sm text-slate-600">
            {b.email}
            {b.phone && <> · {b.phone}</>}
          </p>
          <p className="text-sm text-slate-600">
            {b.fulfil === 'ship' ? `Ships to ${[a?.line1, a?.city, a?.state, a?.zip].filter(Boolean).join(', ')}` : 'Pickup at BunFest'}
          </p>
          <p className="text-xs font-semibold text-slate-500">
            {b.card_ready ? `Card ready · ${(b.card_brand ?? 'card').replace(/^\w/, (c) => c.toUpperCase())} ${b.card_last4 ?? ''}` : 'No card yet'} · {b.bids} bid{b.bids === 1 ? '' : 's'} · {b.won} won
            {' · '}registered {fmtWhen(b.created_at)}
          </p>
        </div>
        {b.is_blocked ? <Badge tone="slate">Blocked</Badge> : b.card_ready ? <Badge tone="blue">Can bid</Badge> : <Badge tone="orange">No card</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void toggle()} className={b.is_blocked ? small : danger}>
          {b.is_blocked ? 'Unblock' : 'Block'}
        </button>
      </div>
      <p className="text-xs text-slate-500">Their private “Your bids” link is in their registration email; the desk doesn’t hold it.</p>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </Card>
  )
}
