// The auction desk's "Buy it now at the table" panel (update 44).
//   Waiting   — each hold: pickup number, item and its DON number, price,
//               buyer's name and phone, how long ago. "Paid and taken" when
//               they've paid (card reader or cash) and have the item; "Put it
//               back" if they never come (the item goes back on sale).
//   Done      — what's been handed over, and by whom.
//   Set up    — the switch, and which helpers get the phone notification
//               (none picked = everyone who runs the desk).
// Data: auction_table_claims(), every 10 s while the page is open. A new hold
// arriving while the desk is open buzzes the phone and shows at the top.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { errMessage, supabase } from '../../lib/supabase'
import { Card, btn } from '../../components/ui'
import { Icon } from '../../components/icons'
import { Spinner } from '../../components/staffui'
import { AUCTION_EVENT_SLUG } from '../raffle/types'
import { money, type FulfilStatus, type PaymentStatus } from './client'

const HOLDS_POLL_MS = 10_000

interface Claim {
  sale_id: string
  pickup_no: number
  item_id: string
  title: string | null
  photo_url: string | null
  code: string | null
  amount_cents: number
  buyer_name: string | null
  buyer_phone: string | null
  payment_status: PaymentStatus
  fulfil_status: FulfilStatus
  created_at: string
  paid_at: string | null
  updated_at: string
  handled_by: string | null
}
interface Holds {
  now: string
  on: boolean
  helper_user_ids: string[]
  notifications_on: boolean
  claims: Claim[]
}
interface Helper {
  user_id: string
  name: string
  email: string
  has_alerts: boolean
}

const small =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-[15px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60'
const danger =
  'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-[15px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-60'

const isMissing = (m: string) => /could not find the function|does not exist|schema cache|PGRST202/i.test(m)

/** 6145550100 → (614) 555-0100; anything else as given. */
function phoneText(p: string | null): string {
  if (!p) return ''
  return /^\d{10}$/.test(p) ? `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}` : p
}

function ago(iso: string, nowIso: string): string {
  const m = Math.max(0, Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h} h ${m % 60} min ago`
}

const waiting = (c: Claim) => c.payment_status !== 'void' && c.fulfil_status !== 'picked_up'

export default function TableHolds({ orgId, onChange }: { orgId: string; onChange: () => Promise<void> }) {
  const [data, setData] = useState<Holds | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Claim[]>([])
  const [showDone, setShowDone] = useState(false)
  const [setup, setSetup] = useState(false)
  const seen = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    const { data: d, error: e } = await supabase.rpc('auction_table_claims', { p_org: orgId, p_event: AUCTION_EVENT_SLUG })
    if (e) {
      setError(errMessage(e))
      return
    }
    const h = d as unknown as Holds
    // Anything new since the last look: buzz and show it at the top.
    if (seen.current) {
      const added = h.claims.filter((c) => waiting(c) && !seen.current!.has(c.sale_id))
      if (added.length) {
        setFresh((f) => [...added, ...f].slice(0, 5))
        try {
          navigator.vibrate?.([200, 100, 200])
        } catch {
          /* not on this device */
        }
        void onChange()
      }
    }
    seen.current = new Set(h.claims.map((c) => c.sale_id))
    setError(null)
    setData(h)
  }, [orgId, onChange])

  useEffect(() => {
    if (!orgId) return
    void load()
    const t = setInterval(() => {
      if (document.visibilityState !== 'hidden') void load()
    }, HOLDS_POLL_MS)
    return () => clearInterval(t)
  }, [orgId, load])

  const after = async () => {
    await load()
    await onChange()
  }

  if (error && !data) {
    return (
      <Card className="space-y-1 border-amber-200 bg-amber-50/60">
        <p className="font-display text-base font-extrabold text-ink">Buy it now at the table</p>
        <p className="text-sm leading-relaxed text-slate-700">
          {isMissing(error) ? 'Table holds aren’t switched on yet — ask an admin. Until then, record Buy it now buyers with “Record a table sale”.' : error}
        </p>
      </Card>
    )
  }
  if (!data) return <Spinner label="Loading Buy it now…" />

  const open = data.claims.filter(waiting).sort((a, b) => a.pickup_no - b.pickup_no)
  const done = data.claims.filter((c) => !waiting(c))

  return (
    <Card className={`space-y-3 ${open.length ? 'border-brand-orange' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-extrabold text-ink">Buy it now at the table</p>
          <p className="text-sm text-slate-600">
            {data.on ? (open.length ? `${open.length} waiting to pay` : 'On — nobody waiting') : 'Off — the QR codes show the item only'}
          </p>
        </div>
        <button type="button" onClick={() => setSetup((v) => !v)} className={small}>
          {setup ? 'Close' : 'Set up'}
        </button>
      </div>

      {setup && <Setup orgId={orgId} data={data} onSaved={load} />}

      {fresh.length > 0 && (
        <div className="space-y-1 rounded-xl bg-brand-orange px-3 py-2 text-sm font-bold text-ink" role="alert">
          {fresh.map((c) => (
            <p key={c.sale_id}>
              New: #{c.pickup_no} {c.title} — {c.buyer_name}, {money(c.amount_cents)}
            </p>
          ))}
          <button type="button" onClick={() => setFresh([])} className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-4 text-[15px] font-bold text-ink">
            Got it
          </button>
        </div>
      )}

      {open.map((c) => (
        <HoldRow key={c.sale_id} c={c} now={data.now} onDone={after} />
      ))}

      {done.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDone((v) => !v)} className={small} aria-expanded={showDone}>
            {showDone ? 'Hide' : 'Show'} handed over and put back ({done.length})
          </button>
          {showDone && (
            <ul className="divide-y divide-slate-100 text-sm">
              {done.map((c) => (
                <li key={c.sale_id} className="py-1.5">
                  <span className="font-bold text-ink">#{c.pickup_no}</span> {c.title} · {money(c.amount_cents)} · {c.buyer_name}
                  <span className="block text-xs text-slate-500">
                    {c.payment_status === 'void' ? 'Put back' : `Paid and taken${c.handled_by ? ` · ${c.handled_by}` : ''}`} · {ago(c.updated_at, data.now)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

function HoldRow({ c, now, onDone }: { c: Claim; now: string; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paid = c.payment_status === 'cash' || c.payment_status === 'paid'
  const old = new Date(now).getTime() - new Date(c.created_at).getTime() > 20 * 60000

  const update = async (patch: { p_payment_status?: string; p_fulfil_status?: string }) => {
    setBusy(true)
    setError(null)
    try {
      const { error: e } = await supabase.rpc('auction_update_sale', { p_sale_id: c.sale_id, ...patch })
      if (e) throw e
      await onDone()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <span className="font-display text-3xl font-black leading-none text-ink">#{c.pickup_no}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold text-ink">{c.title}</p>
          <p className="text-sm text-slate-700">
            <span className="font-bold text-ink">{money(c.amount_cents)}</span>
            {c.code && <> · {c.code}</>}
            {paid && <span className="font-bold text-emerald-700"> · paid</span>}
          </p>
          <p className="text-sm text-slate-700">
            {c.buyer_name}
            {c.buyer_phone && (
              <>
                {' · '}
                <a href={`tel:${c.buyer_phone}`} className="font-semibold text-brand-blue">
                  {phoneText(c.buyer_phone)}
                </a>
              </>
            )}
          </p>
          <p className={`text-xs font-semibold ${old ? 'text-brand-orange-dark' : 'text-slate-500'}`}>Held {ago(c.created_at, now)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void update(paid ? { p_fulfil_status: 'picked_up' } : { p_payment_status: 'cash', p_fulfil_status: 'picked_up' })}
          className={`${btn.primary} min-h-[48px] flex-1 disabled:opacity-60`}
        >
          <Icon name="check" size={18} /> {paid ? 'Taken' : 'Paid and taken'}
        </button>
        {!paid && (
          <button
            type="button"
            disabled={busy}
            onClick={() => window.confirm(`Put “${c.title}” back on sale? #${c.pickup_no} is canceled.`) && void update({ p_payment_status: 'void' })}
            className={danger}
          >
            Put it back
          </button>
        )}
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </div>
  )
}

function Setup({ orgId, data, onSaved }: { orgId: string; data: Holds; onSaved: () => Promise<void> }) {
  const [helpers, setHelpers] = useState<Helper[] | null>(null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(data.helper_user_ids))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    supabase.rpc('auction_helper_candidates', { p_org: orgId }).then(({ data: d, error: e }) => {
      if (!alive) return
      if (e) setError(errMessage(e))
      else setHelpers((d as unknown as Helper[]) ?? [])
    })
    return () => {
      alive = false
    }
  }, [orgId])

  const save = async (patch: { p_on?: boolean; p_helpers?: string[] }, done: string) => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const { error: e } = await supabase.rpc('auction_set_table_buy_now', { p_org: orgId, p_event: AUCTION_EVENT_SLUG, ...patch })
      if (e) throw e
      setNote(done)
      await onSaved()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3">
      <div className="space-y-1">
        <p className="text-sm leading-relaxed text-slate-700">
          When it’s on, an item’s QR code offers <span className="font-bold">Buy it now</span> at its Buy Now price: the buyer gives a name and phone
          number, the item is held under a pickup number, and they pay here. Items without a Buy Now price are bid on the sheet only. Prices are set in{' '}
          <Link to="/staff/raffle" className="font-bold text-brand-blue">
            Silent Auction
          </Link>
          .
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save({ p_on: !data.on }, data.on ? 'Buy it now is off.' : 'Buy it now is on.')}
          className={`${data.on ? small : btn.primary} min-h-[48px] w-full disabled:opacity-60`}
        >
          {data.on ? 'Turn Buy it now off' : 'Turn Buy it now on'}
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-bold text-ink">Who gets the notification</p>
        <p className="text-xs leading-relaxed text-slate-500">
          Tick the helpers at the table. With nobody ticked, everyone who runs the desk is told.
          {!data.notifications_on && ' Phone notifications are switched off in Staff → Features, so for now new holds show only on this page.'}{' '}
          A notification reaches a phone that turned notifications on in the web app (ohrr-app.pages.dev, added to the Home Screen on an iPhone) while
          signed in; the Android app can’t receive them yet.
        </p>
        {!helpers && !error && <Spinner label="Loading helpers…" />}
        {helpers?.length === 0 && <p className="text-sm text-slate-500">Nobody has “Manage Midwest BunFest info” yet.</p>}
        {helpers?.map((h) => (
          <label key={h.user_id} className="flex min-h-[44px] items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-brand-blue" checked={picked.has(h.user_id)} onChange={() => toggle(h.user_id)} disabled={busy} />
            <span className="min-w-0 flex-1">
              <span className="font-bold text-ink">{h.name}</span>
              <span className={`block text-xs ${h.has_alerts ? 'text-emerald-700' : 'text-slate-500'}`}>
                {h.has_alerts ? 'Notifications on' : 'No notifications on a phone yet'}
              </span>
            </span>
          </label>
        ))}
        {helpers && helpers.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ p_helpers: [...picked] }, picked.size ? `${picked.size} helper${picked.size === 1 ? '' : 's'} will be told.` : 'Everyone who runs the desk will be told.')}
            className={`${small} w-full`}
          >
            Save helpers
          </button>
        )}
      </div>
      {note && <p className="text-sm font-semibold text-emerald-700">{note}</p>}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </div>
  )
}
