import { useState } from 'react'
import { Card, SectionLabel, Badge, btn } from './ui'
import { Icon } from './icons'
import { useFeatureFlag } from '../features/settings/useSetting'
import { RAFFLE_TICKETS_FLAG } from '../features/settings/testFeatures'
import { formatValue, rafflePriceLine, raffleTotalCents, type RafflePricing } from '../features/raffle/types'

const input =
  'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20'

function encode(data: Record<string, string>) {
  return Object.keys(data)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&')
}

function makeCode() {
  return `MWBF-${Math.floor(10000 + Math.random() * 90000)}`
}

// TEST FEATURE — reserve numbered raffle tickets in the app and pay at the
// raffle table. Hidden by default: it renders only while an owner has switched
// on `raffle_tickets_enabled` in /staff/settings. Pricing is never hard-coded:
// it comes from auction_settings (staff enter it in /staff/raffle → Auction
// setup); when unset, no price or total is shown at all.
//
// Reservations post to the Netlify Form `raffle-request` (registered as a
// hidden form in index.html) — quantity, total, ticket codes, name, phone.
// Ticket codes are generated client-side; there is no payment processing.
export function RaffleTickets({ pricing }: { pricing: RafflePricing | null }) {
  const flag = useFeatureFlag(RAFFLE_TICKETS_FLAG)
  if (flag.loading || !flag.value) return null
  return <RaffleTicketsForm pricing={pricing} />
}

function RaffleTicketsForm({ pricing }: { pricing: RafflePricing | null }) {
  const [qty, setQty] = useState(1)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [tickets, setTickets] = useState<string[]>([])

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const priceLine = rafflePriceLine(pricing)
  const total = raffleTotalCents(pricing, qty)
  const totalLabel = total === null ? '' : formatValue(total) ?? ''

  const onSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setStatus('submitting')
    const codes = Array.from({ length: qty }, makeCode)
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encode({
          'form-name': 'raffle-request',
          quantity: String(qty),
          total: totalLabel,
          tickets: codes.join(', '),
          ...form,
        }),
      })
      setTickets(codes)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const label = (
    <div className="flex items-center gap-2">
      <SectionLabel>{status === 'done' ? 'Your raffle tickets' : 'Get raffle tickets'}</SectionLabel>
      <Badge tone="orange">Preview</Badge>
    </div>
  )

  if (status === 'done') {
    return (
      <section className="space-y-2.5">
        {label}
        <Card className="border-brand-orange/30 bg-brand-orange-50/40">
          <h3 className="font-display text-base font-extrabold text-ink">
            {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} reserved
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Show these at the raffle table to pay
            {totalLabel && (
              <>
                {' '}
                <strong className="font-bold text-ink">{totalLabel}</strong>
              </>
            )}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tickets.map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-orange/40 bg-white px-2.5 py-1.5 font-mono text-sm font-bold text-brand-orange-dark"
              >
                <Icon name="ticket" size={14} /> {c}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Test feature — payment happens in person at the raffle table; nothing is charged in
            the app.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-2.5">
      {label}
      <Card>
        <form
          name="raffle-request"
          method="POST"
          data-netlify="true"
          netlify-honeypot="bot-field"
          onSubmit={onSubmit}
          className="space-y-3.5"
        >
          <input type="hidden" name="form-name" value="raffle-request" />
          <input type="hidden" name="quantity" value={qty} />
          <input type="hidden" name="total" value={totalLabel} />
          <p className="hidden">
            <label>
              Don’t fill this out: <input name="bot-field" />
            </label>
          </p>

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">How many tickets?</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Fewer"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50"
              >
                −
              </button>
              <span className="w-6 text-center font-display text-lg font-black text-ink">{qty}</span>
              <button
                type="button"
                aria-label="More"
                onClick={() => setQty((q) => Math.min(60, q + 1))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50"
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
            <input className={input} name="name" required value={form.name} onChange={set('name')} />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Phone
            <input className={input} type="tel" name="phone" required value={form.phone} onChange={set('phone')} />
          </label>

          {status === 'error' && (
            <p className="text-sm font-semibold text-red-600">Something went wrong — please try again.</p>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`${btn.primary} w-full disabled:opacity-60`}
          >
            {status === 'submitting' ? 'Reserving…' : `Get ${qty} ${qty === 1 ? 'ticket' : 'tickets'}`}
          </button>
          <p className="text-center text-xs leading-relaxed text-slate-400">
            Reserves your numbered tickets — pay at the raffle table at BunFest. Test feature;
            nothing is charged in the app.
          </p>
        </form>
      </Card>
    </section>
  )
}
