import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import { Card, SectionLabel, Badge, btn } from './ui'
import { Icon } from './icons'
import { useFeatureFlag } from '../features/settings/useSetting'
import { RAFFLE_TICKETS_FLAG, RAFFLE_TICKETS_NATIVE_FLAG } from '../features/settings/testFeatures'
import { isNative } from '../native/platform'
import { formatValue, rafflePriceLine, raffleTotalCents, AUCTION_EVENT_SLUG, type RafflePricing } from '../features/raffle/types'
import { reserveTickets, ticketLabel, ticketPageUrl, type RaffleOrder } from '../features/raffle/tickets/api'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

const LAST_ORDER_KEY = 'ohrr.raffle.lastOrder'

// Reserve numbered raffle tickets in the app and pay at the raffle table.
// Shown only while `raffle_tickets_enabled` is on (Staff → Settings → Test
// features). Pricing comes from auction_settings (Staff → Silent Auction →
// Auction setup); when unset, no price or total is shown at all. Every ticket
// gets a real number from the event's sequence (raffle_tickets); payment
// happens at the table — nothing is charged in the app.
export function RaffleTickets({ pricing }: { pricing: RafflePricing | null }) {
  const flag = useFeatureFlag(RAFFLE_TICKETS_FLAG)
  // Inside the installed apps a second switch applies (ON unless staff turn it off).
  const nativeFlag = useFeatureFlag(RAFFLE_TICKETS_NATIVE_FLAG, true)
  if (flag.loading || !flag.value) return null
  if (isNative && (nativeFlag.loading || !nativeFlag.value)) return null
  return <RaffleTicketsForm pricing={pricing} />
}

function RaffleTicketsForm({ pricing }: { pricing: RafflePricing | null }) {
  const [qty, setQty] = useState(1)
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<RaffleOrder | null>(null)
  const [last, setLast] = useState<{ token: string; qty: number } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY)
      if (raw) setLast(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const priceLine = rafflePriceLine(pricing)
  const total = raffleTotalCents(pricing, qty)
  const totalLabel = total === null ? '' : formatValue(total) ?? ''

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    try {
      const o = await reserveTickets(AUCTION_EVENT_SLUG, qty, form.name, form.phone, form.email || undefined)
      setOrder(o)
      setStatus('done')
      try {
        localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ token: o.claim_token, qty: o.qty }))
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong — please try again.')
      setStatus('error')
    }
  }

  const label = (
    <div className="flex items-center gap-2">
      <SectionLabel>{status === 'done' ? 'Your raffle tickets' : 'Get raffle tickets'}</SectionLabel>
      <Badge tone="orange">Pay at the table</Badge>
    </div>
  )

  if (status === 'done' && order) {
    return (
      <section className="space-y-2.5">
        {label}
        <TicketCard order={order} />
      </section>
    )
  }

  return (
    <section className="space-y-2.5">
      {label}
      {last && (
        <Link to={`/raffle/tickets/${last.token}`} className="flex items-center justify-between gap-3 rounded-2xl border border-brand-blue/20 bg-brand-blue-50/60 px-4 py-3 text-sm font-bold text-brand-blue">
          <span>
            <Icon name="ticket" size={14} className="mr-1 inline" /> Show my {last.qty} {last.qty === 1 ? 'ticket' : 'tickets'}
          </span>
          <Icon name="chevron" size={16} />
        </Link>
      )}
      <Card>
        <form onSubmit={onSubmit} className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">How many tickets?</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Fewer"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50"
              >
                −
              </button>
              <span className="w-8 text-center font-display text-xl font-black text-ink">{qty}</span>
              <button
                type="button"
                aria-label="More"
                onClick={() => setQty((q) => Math.min(60, q + 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>
          {/* Price line only when staff have entered pricing — never a placeholder. */}
          {(priceLine || totalLabel) && (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {priceLine}
              {priceLine && totalLabel && ' · '}
              {totalLabel && <strong className="font-bold text-ink">Total: {totalLabel}</strong>}
            </p>
          )}

          <label className="block text-sm font-semibold text-slate-700">
            Your name
            <input className={input} name="name" required value={form.name} onChange={set('name')} autoComplete="name" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Phone
            <input className={input} type="tel" name="phone" required value={form.phone} onChange={set('phone')} autoComplete="tel" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email (optional — for a copy of your numbers)
            <input className={input} type="email" name="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </label>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <button type="submit" disabled={status === 'submitting'} className={`${btn.primary} w-full disabled:opacity-60`}>
            {status === 'submitting' ? 'Reserving…' : `Get ${qty} ${qty === 1 ? 'ticket' : 'tickets'}`}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            Your numbered tickets are held for you — pay at the raffle table at BunFest and show this screen. Nothing is charged in the app.
          </p>
        </form>
      </Card>
    </section>
  )
}

/** The ticket numbers, the amount due, the status, and a QR the desk can scan. */
export function TicketCard({ order, link = true }: { order: RaffleOrder; link?: boolean }) {
  const [qr, setQr] = useState('')
  useEffect(() => {
    QRCode.toDataURL(ticketPageUrl(order.claim_token), { errorCorrectionLevel: 'M', margin: 1, width: 360 }).then(setQr).catch(() => setQr(''))
  }, [order.claim_token])
  const amount = formatValue(order.amount_cents)
  const won = order.tickets.filter((t) => t.drawn_at)
  return (
    <Card className={order.status === 'paid' ? 'border-green-200 bg-green-50/40' : order.status === 'void' ? 'border-slate-200 bg-slate-50' : 'border-brand-orange/30 bg-brand-orange-50/40'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-extrabold text-ink">
            {order.qty} {order.qty === 1 ? 'ticket' : 'tickets'} · {order.name}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {order.status === 'paid' && 'Paid — good luck!'}
            {order.status === 'reserved' && (
              <>
                Show this at the raffle table to pay{amount ? <strong className="font-bold text-ink"> {amount}</strong> : ''}.
              </>
            )}
            {order.status === 'void' && 'This reservation was cancelled.'}
          </p>
        </div>
        <Badge tone={order.status === 'paid' ? 'blue' : order.status === 'void' ? 'slate' : 'orange'}>{order.status === 'paid' ? 'Paid' : order.status === 'void' ? 'Cancelled' : 'Reserved'}</Badge>
      </div>
      {won.length > 0 && (
        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand-blue">
          🎉 Winner! {won.map((t) => `${ticketLabel(t.no)}${t.prize ? ` — ${t.prize}` : ''}`).join(' · ')}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {order.tickets.map((t) => (
          <span key={t.id} className={`inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-sm font-bold ${t.drawn_at ? 'border-brand-blue text-brand-blue' : 'border-brand-orange/40 text-brand-orange-dark'}`}>
            <Icon name="ticket" size={14} /> {ticketLabel(t.no)}
          </span>
        ))}
      </div>
      {qr && (
        <div className="mt-4 flex items-center gap-3">
          <img src={qr} alt="QR code for these tickets" className="h-24 w-24 rounded-lg bg-white p-1" />
          <p className="text-xs leading-relaxed text-slate-500">
            The raffle table scans this to find your tickets. Your numbers go into the same draw as paper tickets once you have paid.
          </p>
        </div>
      )}
      {link && (
        <Link to={`/raffle/tickets/${order.claim_token}`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-brand-blue">
          Open my ticket page <Icon name="chevron" size={14} />
        </Link>
      )}
    </Card>
  )
}
