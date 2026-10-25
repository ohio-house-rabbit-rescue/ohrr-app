// Buy it now, pay at the auction table (update 44). No card online: the buyer
// scans the QR on the bid sheet, taps Buy it now, gives a name and phone
// number, and the item is held under a pickup number. The auction helpers'
// phones get a notification; the buyer pays at the table (card reader or
// cash) and a helper taps "Paid and taken" on the auction desk.
//
// The hold is remembered on this device, so the pickup number is still there
// after a reload; it updates itself (every 10 s) when the table marks it paid.
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { staffInput } from '../../components/staffui'
import {
  fetchHold,
  holdItem,
  money,
  recallBuyer,
  rememberBuyer,
  rememberHold,
  type AuctionItem,
  type HoldStatus,
  type RememberedHold,
} from './client'

const HOLD_POLL_MS = 10_000

/** The Buy it now button and its popup. */
export function BuyAtTable({ item, onHeld }: { item: AuctionItem; onHeld: (h: RememberedHold) => void }) {
  const [open, setOpen] = useState(false)
  if (item.buy_now_cents == null) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${btn.primary} min-h-[52px] w-full flex-col !gap-0 text-base`}>
        <span>Buy it now — {money(item.buy_now_cents)}</span>
        <span className="text-xs font-semibold opacity-90">Pay at the auction table</span>
      </button>
      {open && <HoldSheet item={item} onClose={() => setOpen(false)} onHeld={onHeld} />}
    </>
  )
}

function HoldSheet({ item, onClose, onHeld }: { item: AuctionItem; onClose: () => void; onHeld: (h: RememberedHold) => void }) {
  const [name, setName] = useState(() => recallBuyer().name)
  const [phone, setPhone] = useState(() => recallBuyer().phone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Please give your name.')
    if (phone.replace(/\D/g, '').length < 7) return setError('Please give a phone number we can reach you on.')
    setBusy(true)
    setError(null)
    try {
      const h = await holdItem(supabase, item.id, name.trim(), phone.trim())
      rememberHold(h)
      rememberBuyer(name.trim(), phone.trim())
      onHeld(h)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That didn’t go through. Please try again, or go to the auction table.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Buy ${item.title} now`}>
      <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="relative z-10 max-h-[90vh] w-full max-w-[480px] space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 pb-8 shadow-2xl">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
        <div>
          <h2 className="font-display text-xl font-black text-ink">Buy it now for {money(item.buy_now_cents)}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            <span className="font-bold text-ink">{item.title}</span> is held for you straight away. Then go to the auction table to pay — card or
            cash — and take it home.
          </p>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Your name
          <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} disabled={busy} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Phone number
          <input className={staffInput} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" maxLength={24} disabled={busy} />
        </label>
        <p className="text-xs leading-relaxed text-slate-500">Only the auction helpers see these, to hand you the right item.</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={busy} className={`${btn.primary} min-h-[52px] flex-1 text-base disabled:opacity-60`}>
            {busy ? 'Holding it…' : 'Hold it for me'}
          </button>
          <button type="button" disabled={busy} onClick={onClose} className="min-h-[52px] rounded-full border border-slate-200 px-5 text-sm font-bold text-slate-500 hover:bg-slate-50">
            Not now
          </button>
        </div>
      </form>
    </div>
  )
}

/** The buyer's pickup number and where the hold stands. */
export function HoldCard({ hold, onForget }: { hold: RememberedHold; onForget: () => void }) {
  const [status, setStatus] = useState<HoldStatus | null | undefined>(undefined)

  useEffect(() => {
    let alive = true
    const load = () =>
      fetchHold(supabase, hold.claim_token)
        .then((s) => alive && setStatus(s))
        .catch(() => {
          /* keep what we have; try again on the next tick */
        })
    void load()
    const t = setInterval(() => {
      if (document.visibilityState !== 'hidden') void load()
    }, HOLD_POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [hold.claim_token])

  const state = status?.state ?? 'waiting'
  // The table no longer knows this hold (a test, or the record was removed).
  if (status === null) {
    return (
      <div className="space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>We can’t find your hold for this item any more. Please ask at the auction table.</p>
        <button type="button" onClick={onForget} className="font-bold text-brand-blue">
          Hide this
        </button>
      </div>
    )
  }

  if (state === 'cancelled') {
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" role="status">
        <p className="font-display text-base font-extrabold text-ink">This hold was cancelled at the table</p>
        <p className="text-sm text-slate-600">If that’s a mistake, please see an auction helper.</p>
        <button type="button" onClick={onForget} className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-blue">
          OK
        </button>
      </div>
    )
  }

  if (state === 'done') {
    return (
      <div className="space-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status" aria-live="polite">
        <p className="font-display text-lg font-extrabold text-emerald-800">It’s yours — thank you!</p>
        <p className="text-sm text-emerald-900">
          Paid and collected: {hold.title}, {money(hold.amount_cents)}. Thank you for helping the rabbits.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-2xl border-2 border-brand-orange bg-brand-orange-50/60 px-4 py-4 text-center" role="status" aria-live="polite">
      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Your pickup number</p>
      <p className="font-display text-6xl font-black leading-none text-ink">#{hold.pickup_no}</p>
      <p className="text-sm font-bold text-ink">
        {hold.title} · {money(hold.amount_cents)}
      </p>
      {state === 'paid' ? (
        <p className="text-sm font-semibold text-emerald-800">Paid — collect it at the auction table.</p>
      ) : (
        <p className="text-sm leading-relaxed text-slate-700">
          <span className="inline-flex items-center gap-1 font-bold text-ink">
            <Icon name="check" size={16} /> Held for you.
          </span>{' '}
          Go to the auction table and show this screen. Pay there — card or cash.
        </p>
      )}
      {status?.pickup_note && <p className="text-xs leading-relaxed text-slate-500">{status.pickup_note}</p>}
    </div>
  )
}
