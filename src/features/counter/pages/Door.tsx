// Counter → Door tickets. Two jobs:
//
//   Check a receipt   type (or scan) the receipt number from their email or
//                     printout → "Smith — 2 adults, 1 child" → Let them in.
//                     Already used? It says when and at which door. Not on
//                     the list? It says so, and offers a sale instead.
//   Sell at the door  how many adults, children 5–12 and under 5 → the total
//                     → Paid cash / Paid by card.
//
// Works with no signal: the ticket list lives on the phone, and every entry
// waits there until it can be sent (see door.ts).
import { Suspense, lazy, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { Icon } from '../../../components/icons'
import { BigButton, BigInput, StepShell, Stepper } from '../../scan/ScanUI'
import { clock, getDevice, money, newId } from '../local'
import {
  checkReceipt,
  duplicates,
  findByName,
  heads,
  normalizeReceipt,
  partyText,
  totals,
  useDoorSettings,
  useDoorSync,
  walkupCents,
  type CheckResult,
  type DoorEntry,
  type DoorMethod,
  type DoorTicket,
} from '../door'
import { SyncPill, useCounterOrg } from '../CounterShell'

const Scanner = lazy(() => import('../../scan/Scanner'))

type Tab = 'check' | 'sell'

const OVERRIDES = ['Part of their party came in earlier', 'A manager checked it', 'Other']

export default function Door() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const { orgId } = useCounterOrg()
  const settings = useDoorSettings(orgId)
  const door = useDoorSync(orgId, settings.event_key)
  const device = getDevice().name || 'Door'
  const [tab, setTab] = useState<Tab>('check')
  const [flash, setFlash] = useState<string | null>(null)

  const t = useMemo(() => totals(door.tickets, door.entries), [door.tickets, door.entries])
  const twice = useMemo(() => duplicates(door.entries), [door.entries])
  const mine = useMemo(
    () => door.entries.filter((e) => e.device === device && e.kind !== 'void').slice(-4).reverse(),
    [door.entries, device],
  )
  const voided = useMemo(() => new Set(door.entries.filter((e) => e.kind === 'void').map((e) => e.voids)), [door.entries])

  const record = (e: Omit<DoorEntry, 'id' | 'at' | 'device'>) => {
    door.record({ ...e, id: newId(), at: new Date().toISOString(), device })
  }
  const say = (m: string) => {
    setFlash(m)
    setTimeout(() => setFlash(null), 2500)
  }

  return (
    <StepShell title="Door tickets" help={settings.event_name} onBack={() => navigate('/staff/counter')} backLabel="Counter">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SyncPill waiting={door.waiting} online={door.online} lastSync={door.lastSync} error={door.error} />
          <span className="text-sm font-bold text-slate-600">
            In so far: <span className="font-display text-lg font-black text-ink">{t.advance + t.atDoor}</span>
          </span>
        </div>

        {door.tickets.length === 0 && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The advance-ticket list isn’t on this phone yet.{' '}
            {door.online ? 'It’s loading…' : 'Open this screen once where there’s signal, before doors open.'}{' '}
            Selling at the door works either way.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['check', 'Check a receipt'],
              ['sell', 'Sell at the door'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-[56px] rounded-2xl font-display text-base font-extrabold ${tab === k ? 'bg-ink text-white' : 'border-2 border-slate-200 bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {flash && (
          <p className="flex items-center gap-2 rounded-2xl bg-green-50 px-4 py-3 font-display text-lg font-extrabold text-green-800" role="status">
            <Icon name="check" size={22} /> {flash}
          </p>
        )}

        {tab === 'check' ? (
          <CheckReceipt
            tickets={door.tickets}
            entries={door.entries}
            onAdmit={(ticket, reason) => {
              record({
                kind: 'ticket',
                ticket_code: ticket.code,
                adults: ticket.adults,
                children: ticket.children,
                under5: ticket.under5,
                method: null,
                amount_cents: 0,
                override_reason: reason,
                voids: null,
              })
              say(`${ticket.name || 'Receipt ' + ticket.code} — in (${heads(ticket)})`)
            }}
            onSellInstead={() => setTab('sell')}
          />
        ) : (
          <SellAtDoor
            prices={settings.prices}
            onPaid={(n, method, cents) => {
              record({ kind: 'walkup', ticket_code: null, ...n, method, amount_cents: cents, override_reason: null, voids: null })
              say(`${partyText(n)} — ${cents ? money(cents) + (method === 'card' ? ' by card' : ' cash') : 'free'}`)
            }}
          />
        )}

        {mine.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white">
            <p className="px-4 pt-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">Just now on this phone</p>
            <ul className="divide-y divide-slate-100">
              {mine.map((e) => {
                const gone = voided.has(e.id)
                const recent = Date.now() - new Date(e.at).getTime() < 15 * 60_000
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                    <span className={gone ? 'text-slate-400 line-through' : 'text-ink'}>
                      {clock(e.at)} · {e.kind === 'ticket' ? `Receipt ${e.ticket_code}` : `At the door, ${e.method ?? ''} ${money(e.amount_cents)}`} ·{' '}
                      {partyText(e)}
                    </span>
                    {!gone && recent && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('Take this one back? (A mistake, or they didn’t come in.)')) return
                          record({ kind: 'void', ticket_code: e.ticket_code, adults: 0, children: 0, under5: 0, method: null, amount_cents: 0, override_reason: null, voids: e.id })
                        }}
                        className="shrink-0 font-bold text-red-600"
                      >
                        Undo
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Advance</p>
            <p className="font-display text-xl font-black text-ink">{t.advance}</p>
            <p className="text-slate-500">
              {t.ticketsUsed} of {t.ticketsTotal} receipts
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">At the door</p>
            <p className="font-display text-xl font-black text-ink">{t.atDoor}</p>
            <p className="text-slate-500">
              {money(t.cashCents)} cash · {money(t.cardCents)} card
            </p>
          </div>
        </div>

        {twice.length > 0 && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {twice.length} {twice.length === 1 ? 'receipt was' : 'receipts were'} let in twice.{' '}
            {can('events.bunfest.manage') ? (
              <Link to="/staff/counter/door/setup" className="font-bold underline">
                See which
              </Link>
            ) : (
              'A manager can see which under Door setup.'
            )}
          </p>
        )}
      </div>
    </StepShell>
  )
}

/* ================================================= check a receipt */

function CheckReceipt({
  tickets,
  entries,
  onAdmit,
  onSellInstead,
}: {
  tickets: DoorTicket[]
  entries: DoorEntry[]
  onAdmit: (t: DoorTicket, reason: string | null) => void
  onSellInstead: () => void
}) {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<CheckResult | null>(null)
  const [byName, setByName] = useState('')
  const [scanning, setScanning] = useState(false)
  const [why, setWhy] = useState<string | null>(null)
  const matches = useMemo(() => findByName(byName, tickets), [byName, tickets])

  const check = (raw: string) => {
    if (!normalizeReceipt(raw)) return
    setWhy(null)
    setResult(checkReceipt(raw, tickets, entries))
  }
  const clear = () => {
    setCode('')
    setByName('')
    setResult(null)
    setWhy(null)
  }
  const admit = (t: DoorTicket, reason: string | null) => {
    onAdmit(t, reason)
    clear()
  }

  if (scanning) {
    return (
      <div className="space-y-3">
        <Suspense fallback={null}>
          <Scanner
            onResult={(raw) => {
              setScanning(false)
              setCode(raw)
              check(raw)
            }}
            onTypeInstead={() => setScanning(false)}
          />
        </Suspense>
      </div>
    )
  }

  if (result) {
    if (result.status === 'ok') {
      return (
        <div className="space-y-3 rounded-3xl border-4 border-green-500 bg-green-50 p-5">
          <p className="font-display text-sm font-extrabold uppercase tracking-wider text-green-700">Valid</p>
          <p className="font-display text-2xl font-black text-ink">{result.ticket.name || `Receipt ${result.ticket.code}`}</p>
          <p className="text-lg text-slate-700">{partyText(result.ticket)}</p>
          <p className="text-sm text-slate-500">Receipt {result.ticket.code} · check the name on their receipt matches.</p>
          <BigButton onClick={() => admit(result.ticket, null)} icon="check">
            Let them in
          </BigButton>
          <BigButton onClick={clear} tone="plain">
            Cancel
          </BigButton>
        </div>
      )
    }
    if (result.status === 'used') {
      return (
        <div className="space-y-3 rounded-3xl border-4 border-red-500 bg-red-50 p-5">
          <p className="font-display text-sm font-extrabold uppercase tracking-wider text-red-700">Already used</p>
          <p className="font-display text-2xl font-black text-ink">{result.ticket.name || `Receipt ${result.ticket.code}`}</p>
          <p className="text-base text-slate-700">{partyText(result.ticket)}</p>
          <ul className="space-y-1 text-base text-red-800">
            {result.uses.map((u) => (
              <li key={u.id}>
                Let in at {clock(u.at)}
                {u.device ? ` · ${u.device}` : ''}
              </li>
            ))}
          </ul>
          {why === null ? (
            <>
              <BigButton onClick={clear}>Don’t let in</BigButton>
              <button type="button" onClick={() => setWhy('')} className="w-full py-2 text-center text-sm font-bold text-slate-600 underline">
                Let in anyway…
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Why? (it’s kept with the entry)</p>
              {OVERRIDES.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => (o === 'Other' ? setWhy('Other: ') : admit(result.ticket, o))}
                  className="block w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-base font-bold text-ink"
                >
                  {o}
                </button>
              ))}
              {why.startsWith('Other') && (
                <>
                  <BigInput value={why} onChange={setWhy} ariaLabel="Why" autoFocus />
                  <BigButton onClick={() => admit(result.ticket, why)} disabled={why.trim().length < 8}>
                    Let in
                  </BigButton>
                </>
              )}
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="space-y-3 rounded-3xl border-4 border-amber-400 bg-amber-50 p-5">
        <p className="font-display text-sm font-extrabold uppercase tracking-wider text-amber-700">Not on the list</p>
        <p className="font-display text-2xl font-black text-ink">Receipt {result.code}</p>
        <p className="text-base text-slate-700">
          Check the number against their receipt, or try their name below. Bought in the last few hours? The list on this phone may not have it yet.
        </p>
        <BigButton onClick={onSellInstead} tone="blue">
          Sell them tickets instead
        </BigButton>
        <BigButton onClick={clear} tone="plain">
          Try again
        </BigButton>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <BigInput value={code} onChange={setCode} placeholder="Receipt number" ariaLabel="Receipt number" mono onEnter={() => check(code)} />
      <div className="grid grid-cols-2 gap-2">
        <BigButton onClick={() => check(code)} disabled={!normalizeReceipt(code)} icon="search">
          Check
        </BigButton>
        <BigButton onClick={() => setScanning(true)} tone="outline" icon="scan">
          Scan
        </BigButton>
      </div>
      <input
        className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-lg outline-none focus:border-brand-blue"
        value={byName}
        onChange={(e) => setByName(e.target.value)}
        placeholder="No receipt? Find their name"
        aria-label="Find by name"
        autoComplete="off"
      />
      {matches.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {matches.map((m) => (
            <li key={m.code}>
              <button
                type="button"
                onClick={() => {
                  setCode(m.code)
                  check(m.code)
                }}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <span className="font-bold text-ink">{m.name}</span>
                <span className="text-sm text-slate-500">
                  {m.code} · {heads(m)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ================================================= sell at the door */

function SellAtDoor({
  prices,
  onPaid,
}: {
  prices: { adult: number; child: number; under5: number }
  onPaid: (n: { adults: number; children: number; under5: number }, method: DoorMethod, cents: number) => void
}) {
  const [n, setN] = useState({ adults: 0, children: 0, under5: 0 })
  const cents = walkupCents(prices, n)
  const people = heads(n)
  const done = (m: DoorMethod) => {
    onPaid(n, m, cents)
    setN({ adults: 0, children: 0, under5: 0 })
  }
  const row = (key: keyof typeof n, label: string, price: number) => (
    <div className="space-y-1.5">
      <p className="flex items-baseline justify-between text-base font-bold text-ink">
        {label} <span className="text-sm font-semibold text-slate-500">{price ? `${money(price)} each` : 'free'}</span>
      </p>
      <Stepper value={n[key]} onChange={(v) => setN({ ...n, [key]: v })} ariaLabel={label} />
    </div>
  )
  return (
    <div className="space-y-4">
      {row('adults', 'Adults', prices.adult)}
      {row('children', 'Children 5–12', prices.child)}
      {row('under5', 'Under 5', prices.under5)}
      <p className="text-center font-display text-3xl font-black text-ink">{people ? money(cents) : '—'}</p>
      {cents > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <BigButton onClick={() => done('cash')} disabled={!people}>
            Paid cash
          </BigButton>
          <BigButton onClick={() => done('card')} tone="blue" disabled={!people}>
            Paid by card
          </BigButton>
        </div>
      ) : (
        <BigButton onClick={() => done('free')} disabled={!people}>
          Let them in — free
        </BigButton>
      )}
    </div>
  )
}
