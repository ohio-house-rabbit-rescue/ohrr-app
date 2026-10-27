// Staff → Raffle tickets: the raffle table on a phone. The job starts here with
// its three steps listed in order, each with its buttons:
//   1 Sell tickets          — Reservations (who reserved in the app; scan their QR
//                             or search; Mark paid when the cash changes hands;
//                             Void mistakes) and Sell (tickets sold at the table,
//                             paid at once, so paper buyers are in the same draw)
//   2 Draw the winners      — pick a prize, Draw a winner (random among paid
//                             tickets), or type the number pulled from the
//                             bucket; winners list with Undo
//   3 Hand over the prizes  — the winners with a Call/Text button each, and the
//                             "I'm done" summary with its spreadsheet and PDF
// Built to be modified during the test phase.
import { Suspense, lazy, useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../../lib/auth'
import { errMessage, supabase } from '../../../../lib/supabase'
import { eventDate, useBunfestEvent } from '../../../../lib/events'
import { Screen, Card, Badge, SectionLabel, btn } from '../../../../components/ui'
import { Icon } from '../../../../components/icons'
import { Explain, StaffTitle } from '../../../../components/StaffTitle'
import { Spinner, staffInput } from '../../../../components/staffui'
import { StepButton, StepRow, StepRows, WorkingOn, pill } from '../../../../components/StaffJob'
import ExportButtons from '../../../../components/ExportButtons'
import { useOrgBits } from '../../../volunteers/orgBits'
import { AUCTION_EVENT_SLUG, formatValue, rafflePriceLine, type AuctionSettings } from '../../types'
import { deskOrders, deskSummary, drawTicket, money, orderByToken, recordBucketDraw, sellAtTable, setOrderStatus, ticketLabel, ticketRange, tokenFromScan, undoDraw, winners, type DeskSummary, type RaffleOrder, type RaffleWinner } from '../api'
import { raffleSheet, raffleSummaryPdf, raffleTotals, type RafflePrize } from '../raffleSummary'

const Scanner = lazy(() => import('../../../scan/Scanner'))

type Tab = 'desk' | 'sell' | 'draw' | 'winners'
const TABS: readonly Tab[] = ['desk', 'sell', 'draw', 'winners']
type Prize = RafflePrize

// Card buttons are 40px by default; on a table phone they are 44px.
const act = (p: string) => `${p} !min-h-[44px]`

export default function RaffleDesk() {
  const { membership, can } = useAuth()
  const bunfest = useBunfestEvent()
  const orgId = membership?.orgId ?? ''
  const [params, setParams] = useSearchParams()
  const [summary, setSummary] = useState<DeskSummary | null>(null)
  const [settings, setSettings] = useState<Pick<AuctionSettings, 'raffle_ticket_price_cents' | 'raffle_bundle_qty' | 'raffle_bundle_price_cents'> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshSummary = useCallback(async () => {
    if (!orgId) return
    try {
      setSummary(await deskSummary(orgId, AUCTION_EVENT_SLUG))
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void refreshSummary()
  }, [refreshSummary])

  // The ticket price, from the auction setup, for the Working on bar.
  useEffect(() => {
    if (!orgId) return
    let alive = true
    supabase
      .from('auction_settings')
      .select('raffle_ticket_price_cents, raffle_bundle_qty, raffle_bundle_price_cents')
      .eq('org_id', orgId)
      .eq('event_slug', AUCTION_EVENT_SLUG)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setSettings(data ?? null)
      })
    return () => {
      alive = false
    }
  }, [orgId])

  const isManager = can('events.bunfest.manage')
  const wanted = params.get('tab')
  // Drawing winners and the summary stay with BunFest managers.
  const tab: Tab = TABS.includes(wanted as Tab) && (isManager || (wanted !== 'draw' && wanted !== 'winners')) ? (wanted as Tab) : 'desk'
  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'desk') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  if (!isManager && !can('counter.use')) return <Screen><p className="text-sm text-slate-600">You don’t have access to the raffle desk.</p></Screen>

  const tone = (t: Tab) => (tab === t ? ('blue' as const) : ('outline' as const))
  const priceLine = rafflePriceLine(settings)
  const when = bunfest.startsAt ? eventDate(bunfest) : ''

  return (
    <Screen className="space-y-4">
      <StaffTitle title="Raffle tickets">
        <p>
          The raffle table, on your phone. Prices are set in{' '}
          <Link to="/staff/raffle" className="font-bold text-brand-blue">
            Silent Auction → Auction setup
          </Link>
          ; prizes come from Scan an item.
        </p>
      </StaffTitle>

      <WorkingOn
        icon="ticket"
        tone="blue"
        label="Working on"
        name={`Raffle · ${bunfest.title}`}
        line={[when, priceLine].filter(Boolean).join(' · ') || undefined}
      />

      <StepRows label="How the raffle runs">
        <StepRow n={1} name="Sell tickets">
          <StepButton icon="ticket" tone={tone('sell')} onClick={() => setTab('sell')}>
            Sell at the table
          </StepButton>
          <StepButton icon="check" tone={tone('desk')} count={summary?.reserved} onClick={() => setTab('desk')}>
            Reservations to pay
          </StepButton>
        </StepRow>
        <StepRow n={2} name="Draw the winners" hint={isManager ? undefined : 'a BunFest manager does this'}>
          {isManager && (
            <StepButton icon="sparkles" tone={tone('draw')} onClick={() => setTab('draw')}>
              Draw winners
            </StepButton>
          )}
        </StepRow>
        <StepRow n={3} name="Hand over the prizes" hint={isManager ? undefined : 'a BunFest manager does this'}>
          {isManager && (
            <StepButton icon="phone" tone={tone('winners')} onClick={() => setTab('winners')}>
              Reach the winners · I’m done
            </StepButton>
          )}
        </StepRow>
      </StepRows>

      {summary && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Card className="!p-2">
            <p className="font-display text-xl font-black text-brand-orange">{summary.reserved}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">to pay</p>
          </Card>
          <Card className="!p-2">
            <p className="font-display text-xl font-black text-brand-blue">{summary.paid_tickets}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">paid tickets</p>
          </Card>
          <Card className="!p-2">
            <p className="font-display text-xl font-black text-ink">{money(summary.paid_cents) ?? '—'}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">taken</p>
          </Card>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {tab === 'desk' && <DeskTab orgId={orgId} onChange={refreshSummary} />}
      {tab === 'sell' && <SellTab orgId={orgId} onChange={refreshSummary} />}
      {tab === 'draw' && isManager && <DrawTab orgId={orgId} onChange={refreshSummary} />}
      {tab === 'winners' && isManager && <WinnersTab orgId={orgId} summary={summary} eventName={bunfest.title} />}
    </Screen>
  )
}

/* ------------------------------------------------------------------ desk */
function DeskTab({ orgId, onChange }: { orgId: string; onChange: () => void }) {
  const [q, setQ] = useState('')
  const [orders, setOrders] = useState<RaffleOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [focus, setFocus] = useState<RaffleOrder | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setOrders(await deskOrders(orgId, AUCTION_EVENT_SLUG, q))
      setError(null)
    } catch (e) {
      setError(errMessage(e))
      setOrders([])
    }
  }, [orgId, q])
  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
  }, [load])

  const status = async (o: RaffleOrder, s: RaffleOrder['status']) => {
    setBusy(o.id)
    try {
      const updated = await setOrderStatus(o.id, s)
      setOrders((list) => (list ?? []).map((x) => (x.id === o.id ? updated : x)))
      if (focus?.id === o.id) setFocus(updated)
      onChange()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const onScan = async (raw: string) => {
    const token = tokenFromScan(raw)
    if (!token) {
      setError('That code isn’t a raffle ticket.')
      return
    }
    setScanning(false)
    try {
      const o = await orderByToken(token)
      if (!o) setError('No reservation for that code.')
      else setFocus(o)
    } catch (e) {
      setError(errMessage(e))
    }
  }

  const list = focus ? [focus] : orders

  return (
    <div className="space-y-3">
      <SectionLabel>Step 1 · Reservations</SectionLabel>
      {scanning ? (
        <Card className="!p-2">
          <Suspense fallback={<Spinner />}>
            <Scanner onResult={(raw) => void onScan(raw)} onTypeInstead={() => setScanning(false)} />
          </Suspense>
          <button type="button" onClick={() => setScanning(false)} className={`${btn.outline} mt-2 w-full`}>
            Close the camera
          </button>
        </Card>
      ) : (
        <div className="flex gap-2">
          <input className={`${staffInput} !mt-0 flex-1`} placeholder="Name, phone or ticket number" value={q} onChange={(e) => { setQ(e.target.value); setFocus(null) }} inputMode="search" />
          <button type="button" onClick={() => setScanning(true)} className={`${btn.blue} min-h-[44px] shrink-0 px-4`} aria-label="Scan a ticket QR">
            <Icon name="scan" size={18} /> Scan
          </button>
        </div>
      )}
      {focus && (
        <button type="button" onClick={() => setFocus(null)} className={act(pill.outline)}>
          <Icon name="arrowLeft" size={16} /> All reservations
        </button>
      )}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {list === null && <Spinner />}
      {list && list.length === 0 && <p className="text-sm text-slate-500">{q ? 'Nothing matches.' : 'No reservations yet. They appear here the moment someone taps “Get tickets”.'}</p>}
      {list?.map((o) => (
        <OrderCard key={o.id} order={o} busy={busy === o.id} onStatus={(s) => void status(o, s)} />
      ))}
    </div>
  )
}

function OrderCard({ order: o, busy, onStatus }: { order: RaffleOrder; busy: boolean; onStatus: (s: RaffleOrder['status']) => void }) {
  // Voiding (and un-voiding) stays with BunFest managers; counter volunteers can't.
  const isManager = useAuth().can('events.bunfest.manage')
  const amount = formatValue(o.amount_cents)
  const tone = o.status === 'paid' ? 'blue' : o.status === 'void' ? 'slate' : 'orange'
  return (
    <Card className={o.status === 'void' ? 'opacity-60' : ''}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold text-ink">{o.name}</p>
          <p className="text-sm text-slate-600">
            {o.qty} {o.qty === 1 ? 'ticket' : 'tickets'}
            {amount ? ` · ${amount}` : ''}
            {o.phone ? ` · ${o.phone}` : ''}
            {o.source === 'table' ? ' · sold at the table' : ''}
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-ink">{ticketRange(o.tickets)}</p>
          {o.tickets.some((t) => t.drawn_at) && (
            <p className="mt-1 text-sm font-bold text-brand-blue">Winner: {o.tickets.filter((t) => t.drawn_at).map((t) => `${ticketLabel(t.no)}${t.prize ? ` — ${t.prize}` : ''}`).join(', ')}</p>
          )}
        </div>
        <Badge tone={tone}>{o.status === 'paid' ? 'Paid' : o.status === 'void' ? 'Void' : 'To pay'}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {o.status === 'reserved' && (
          <button type="button" disabled={busy} onClick={() => onStatus('paid')} className={`${btn.primary} min-h-[48px] flex-1 disabled:opacity-60`}>
            <Icon name="check" size={16} /> Mark paid{amount ? ` (${amount})` : ''}
          </button>
        )}
        {o.status === 'paid' && (
          <button type="button" disabled={busy} onClick={() => onStatus('reserved')} className={act(pill.outline)}>
            Undo paid
          </button>
        )}
        {o.status !== 'void' && isManager && (
          <button type="button" disabled={busy} onClick={() => window.confirm(`Void ${o.name}’s ${o.qty} ticket${o.qty === 1 ? '' : 's'}?`) && onStatus('void')} className={act(pill.red)}>
            <Icon name="trash" size={16} /> Void
          </button>
        )}
        {o.status === 'void' && isManager && (
          <button type="button" disabled={busy} onClick={() => onStatus('reserved')} className={act(pill.outline)}>
            Restore
          </button>
        )}
      </div>
      {o.status === 'paid' && (
        <p className="mt-2 text-xs text-slate-500">Drawing from the bucket? Write {ticketRange(o.tickets)} on paper stubs and drop them in.</p>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ sell */
function SellTab({ orgId, onChange }: { orgId: string; onChange: () => void }) {
  const [qty, setQty] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sold, setSold] = useState<RaffleOrder | null>(null)

  const sell = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const o = await sellAtTable(orgId, AUCTION_EVENT_SLUG, qty, name, phone || undefined)
      setSold(o)
      setName('')
      setPhone('')
      setQty(1)
      onChange()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={sell} className="space-y-3">
      <SectionLabel>Step 1 · Sell at the table</SectionLabel>
      <Card className="space-y-3">
        <Explain label="About table sales">
          <p>Cash in hand at the table. The numbers are paid straight away and go into the same draw as app tickets — write them on stubs if you draw from the bucket.</p>
        </Explain>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">How many?</span>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 text-xl font-bold text-slate-500">
              −
            </button>
            <span className="w-10 text-center font-display text-2xl font-black text-ink">{qty}</span>
            <button type="button" aria-label="More" onClick={() => setQty((q) => Math.min(200, q + 1))} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue text-xl font-bold text-white">
              +
            </button>
          </div>
        </div>
        <label className="block text-sm font-semibold text-slate-700">
          Name (optional)
          <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-up" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Phone (optional — to reach a winner who left)
          <input className={staffInput} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
      </Card>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={`${btn.primary} min-h-[56px] w-full text-base disabled:opacity-60`}>
        <Icon name="ticket" size={18} /> {busy ? 'Selling…' : `Sell ${qty} ${qty === 1 ? 'ticket' : 'tickets'}`}
      </button>
      {sold && (
        <Card className="border-green-200 bg-green-50/40">
          <p className="text-sm font-bold text-ink">
            Sold to {sold.name}
            {sold.amount_cents != null ? ` · ${formatValue(sold.amount_cents)}` : ''}
          </p>
          <p className="mt-1 font-mono text-lg font-black text-ink">{ticketRange(sold.tickets)}</p>
          <p className="mt-1 text-xs text-slate-500">Write these on the stubs, or hand them the numbers.</p>
        </Card>
      )}
    </form>
  )
}

/* ------------------------------------------------------------------ draw */
function DrawTab({ orgId, onChange }: { orgId: string; onChange: () => void }) {
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [prizeId, setPrizeId] = useState<string>('')
  const [list, setList] = useState<RaffleWinner[] | null>(null)
  const [latest, setLatest] = useState<RaffleWinner | null>(null)
  const [bucketNo, setBucketNo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [{ data }, w] = await Promise.all([
        supabase.from('raffle_prizes').select('id, title, status').eq('org_id', orgId).eq('event_slug', AUCTION_EVENT_SLUG).order('sort_order').order('title'),
        winners(orgId, AUCTION_EVENT_SLUG),
      ])
      setPrizes(((data ?? []) as Prize[]) ?? [])
      setList(w)
    } catch (e) {
      setError(errMessage(e))
    }
  }, [orgId])
  useEffect(() => {
    void load()
  }, [load])

  const available = prizes.filter((p) => p.status !== 'drawn')

  const draw = async () => {
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const w = await drawTicket(orgId, AUCTION_EVENT_SLUG, prizeId || null)
      setLatest(w)
      setPrizeId('')
      await load()
      onChange()
    } catch (e) {
      setError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }
  const bucket = async (e: FormEvent) => {
    e.preventDefault()
    const no = Number(bucketNo.replace(/[^0-9]/g, ''))
    if (!no) return
    setBusy(true)
    setError(null)
    setNote(null)
    try {
      const w = await recordBucketDraw(orgId, AUCTION_EVENT_SLUG, no, prizeId || null)
      if (w.found === false) setNote(`${ticketLabel(no)} isn’t an app ticket — a paper-roll number. Nothing to record.`)
      else {
        setLatest(w)
        setPrizeId('')
        await load()
        onChange()
      }
      setBucketNo('')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      setBusy(false)
    }
  }
  const undo = async (w: RaffleWinner) => {
    if (!window.confirm(`Undo the draw of ${ticketLabel(w.no)}?`)) return
    try {
      await undoDraw(w.ticket_id)
      if (latest?.ticket_id === w.ticket_id) setLatest(null)
      await load()
      onChange()
    } catch (e) {
      setError(errMessage(e))
    }
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Step 2 · Draw the winners</SectionLabel>
      <Card className="space-y-3">
        <label className="block text-sm font-semibold text-slate-700">
          Prize (optional)
          <select className={staffInput} value={prizeId} onChange={(e) => setPrizeId(e.target.value)}>
            <option value="">— any / not tied to a prize —</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void draw()} disabled={busy} className={`${btn.primary} min-h-[56px] w-full text-base disabled:opacity-60`}>
          <Icon name="ticket" size={18} /> {busy ? 'Drawing…' : 'Draw a winner in the app'}
        </button>
        <p className="text-xs text-slate-500">Random among tickets that are paid and not yet drawn — app and table sales together.</p>
      </Card>
      <form onSubmit={bucket} className="space-y-2">
        <Card className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Or: the number pulled from the bucket</p>
          <div className="flex gap-2">
            <input className={`${staffInput} !mt-0 flex-1 font-mono`} inputMode="numeric" placeholder="A-0042" value={bucketNo} onChange={(e) => setBucketNo(e.target.value)} />
            <button type="submit" disabled={busy || !bucketNo} className={`${btn.blue} min-h-[48px] shrink-0 disabled:opacity-60`}>
              Record
            </button>
          </div>
          <p className="text-xs text-slate-500">If the stub is an app number, the winner is recorded and their ticket page says so.</p>
        </Card>
      </form>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {note && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{note}</p>}
      {latest && (
        <Card className="border-brand-orange/40 bg-brand-orange-50/50 text-center">
          <p className="text-xs font-extrabold uppercase tracking-wider text-brand-orange-dark">Winner</p>
          <p className="mt-1 font-mono text-4xl font-black text-ink">{ticketLabel(latest.no)}</p>
          <p className="mt-1 font-display text-lg font-extrabold text-ink">{latest.name}</p>
          {latest.phone && <p className="text-sm text-slate-600">{latest.phone}</p>}
          {latest.prize && <p className="mt-1 text-sm font-bold text-brand-blue">{latest.prize}</p>}
        </Card>
      )}
      {list && list.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Drawn so far</p>
          {list.map((w) => (
            <WinnerCard key={w.ticket_id} w={w} onUndo={() => void undo(w)} />
          ))}
        </div>
      )}
    </div>
  )
}

/** A drawn ticket: its number, the winner, the prize, and buttons to reach them or undo the draw. */
function WinnerCard({ w, onUndo, reach = false }: { w: RaffleWinner; onUndo?: () => void; reach?: boolean }) {
  const phone = (w.phone ?? '').trim()
  return (
    <Card className="space-y-2 !py-3">
      <div className="min-w-0">
        <p className="font-mono text-sm font-black text-ink">
          {ticketLabel(w.no)} <span className="font-sans font-bold">{w.name}</span>
        </p>
        <p className="text-sm text-slate-600">{w.prize ?? 'No prize recorded'}</p>
        {phone ? <p className="text-sm font-semibold text-slate-700">{phone}</p> : reach ? <p className="text-sm text-slate-500">No phone number — ask at the table.</p> : null}
      </div>
      {((reach && phone) || onUndo) && (
        <div className="flex flex-wrap items-center gap-2">
          {reach && phone && (
            <>
              <a href={`tel:${phone}`} className={act(pill.blue)}>
                <Icon name="phone" size={16} /> Call
              </a>
              <a href={`sms:${phone}`} className={act(pill.soft)}>
                Text
              </a>
            </>
          )}
          {onUndo && (
            <button type="button" onClick={onUndo} className={act(pill.red)}>
              Undo this draw
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

/* --------------------------------------------------- winners, I'm done */
function WinnersTab({ orgId, summary, eventName }: { orgId: string; summary: DeskSummary | null; eventName: string }) {
  const org = useOrgBits()
  const [list, setList] = useState<RaffleWinner[] | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [orders, setOrders] = useState<RaffleOrder[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      winners(orgId, AUCTION_EVENT_SLUG),
      supabase.from('raffle_prizes').select('id, title, status').eq('org_id', orgId).eq('event_slug', AUCTION_EVENT_SLUG).order('sort_order').order('title'),
      deskOrders(orgId, AUCTION_EVENT_SLUG),
    ])
      .then(([w, p, o]) => {
        if (!alive) return
        setList(w)
        setPrizes((p.data ?? []) as Prize[])
        setOrders(o)
      })
      .catch((e) => {
        if (alive) {
          setError(errMessage(e))
          setList([])
        }
      })
    return () => {
      alive = false
    }
  }, [orgId])

  const t = raffleTotals(summary, list ?? [], prizes)
  const cells: { v: string | number; label: string; tone: string }[] = [
    { v: t.ticketsSold, label: 'tickets sold', tone: 'text-brand-blue' },
    { v: money(t.moneyCents) ?? '$0', label: 'money taken', tone: 'text-emerald-700' },
    { v: t.toPay, label: 'still to pay', tone: t.toPay ? 'text-brand-orange' : 'text-ink' },
    { v: t.winners, label: 'winners drawn', tone: 'text-ink' },
    { v: `${t.prizesDrawn} of ${t.prizes}`, label: 'prizes drawn', tone: 'text-ink' },
  ]

  return (
    <div className="space-y-3">
      <SectionLabel>Step 3 · Hand over the prizes</SectionLabel>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      {list === null && <Spinner />}
      {list && list.length === 0 && <p className="text-sm text-slate-500">No winners drawn yet. Draw them in step 2.</p>}
      {list?.map((w) => (
        <WinnerCard key={w.ticket_id} w={w} reach />
      ))}

      <SectionLabel>I’m done</SectionLabel>
      <div className="grid grid-cols-3 gap-2 text-center">
        {cells.map((c) => (
          <Card key={c.label} className="!p-2">
            <p className={`font-display text-xl font-black ${c.tone}`}>{c.v}</p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
          </Card>
        ))}
      </div>
      <p className="text-sm text-slate-600">The PDF has a box beside every winner to tick when their prize is handed over.</p>
      <ExportButtons
        spec={() => raffleSheet(orders, eventName)}
        label="Spreadsheet"
        pdf={{
          label: 'Summary (PDF)',
          title: `Raffle tickets — ${eventName}`,
          filename: `ohrr-raffle-${new Date().toLocaleDateString('en-CA')}`,
          build: () => raffleSummaryPdf(t, list ?? [], prizes, { orgName: org.name, eventName }),
        }}
      />
    </div>
  )
}
