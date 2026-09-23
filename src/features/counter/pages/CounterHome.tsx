// Staff → Counter: the one screen a counter volunteer needs. Big buttons, one
// job each, and a switch for what this phone is for today — the Hop Shop
// (sell, add a new item, the day's takings) or BunFest (the door, sell,
// raffle tickets) — so nobody sees more than the job in front of them.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../lib/auth'
import { Icon, type IconName } from '../../../components/icons'
import { staffInput } from '../../../components/staffui'
import { getDevice, readLocal, setDevice, writeLocal } from '../local'
import { useCounterOrg } from '../CounterShell'

type Mode = 'shop' | 'bunfest'
const MODE_KEY = 'ohrr.counter.mode.v1'

export default function CounterHome() {
  const { can } = useAuth()
  const { offline } = useCounterOrg()
  const [mode, setModeState] = useState<Mode>(() => readLocal<Mode>(MODE_KEY, 'shop'))
  const [device, setDeviceState] = useState(() => getDevice())
  const [naming, setNaming] = useState(!getDevice().name)
  const [name, setName] = useState(device.name)
  const setMode = (m: Mode) => {
    setModeState(m)
    writeLocal(MODE_KEY, m)
  }

  // Fetch the other counter screens now, while there is signal, so they open
  // even if the phone loses it later.
  useEffect(() => {
    void import('./CounterSell')
    void import('./CounterAdd')
    void import('./Door')
    void import('./CounterToday')
    void import('../../scan/Scanner')
  }, [])

  const isManager = can('events.bunfest.manage')
  const tiles: { to: string; title: string; sub: string; icon: IconName; tone: 'orange' | 'blue' }[] =
    mode === 'shop'
      ? [
          { to: '/staff/counter/sell', title: 'Sell', sub: 'Scan or tap what they’re buying, then take the money', icon: 'bag', tone: 'orange' },
          { to: '/staff/counter/add', title: 'Add a new item', sub: 'Photo, name, price — it gets its own number', icon: 'plus', tone: 'blue' },
          { to: '/staff/counter/today', title: 'Today at the till', sub: 'What sold, and the cash and card totals', icon: 'box', tone: 'blue' },
        ]
      : [
          { to: '/staff/counter/door', title: 'Door tickets', sub: 'Check receipts, and sell tickets at the door', icon: 'ticket', tone: 'orange' },
          { to: '/staff/counter/sell', title: 'Sell', sub: 'Hop Shop table — scan or tap, then take the money', icon: 'bag', tone: 'blue' },
          { to: '/staff/raffle-tickets', title: 'Raffle tickets', sub: 'Sell at the table, and take payment for reservations', icon: 'award', tone: 'blue' },
        ]

  return (
    <div className="space-y-5 px-5 py-5">
      <div>
        <h1 className="font-display text-2xl font-black text-ink">Counter</h1>
        {offline && (
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            No signal right now. Selling and the door still work — everything is kept on this phone and sent when the signal is back.
          </p>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-600">This phone is for</p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(
            [
              ['shop', 'The Hop Shop'],
              ['bunfest', 'BunFest'],
            ] as [Mode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-[52px] rounded-2xl font-display text-base font-extrabold ${mode === m ? 'bg-ink text-white' : 'border-2 border-slate-200 bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`flex min-h-[88px] items-center gap-4 rounded-2xl p-4 shadow-md transition active:scale-[.98] ${
              t.tone === 'orange' ? 'bg-brand-orange text-white hover:bg-brand-orange-dark' : 'bg-brand-blue text-white hover:bg-brand-blue-dark'
            }`}
          >
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Icon name={t.icon} size={30} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-xl font-black">{t.title}</span>
              <span className="mt-0.5 block text-sm text-white/90">{t.sub}</span>
            </span>
            <Icon name="chevron" size={22} className="shrink-0 text-white/70" />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {naming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setDeviceState(setDevice({ name: name.trim() }))
              setNaming(false)
            }}
            className="space-y-2"
          >
            <label className="block text-sm font-semibold text-slate-700">
              Give this phone a name
              <input className={staffInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="Door 1, Hop Shop till…" autoComplete="off" />
            </label>
            <p className="text-xs text-slate-500">It’s shown on every sale and ticket this phone records, so a question afterwards has an answer.</p>
            <button type="submit" disabled={!name.trim()} className="rounded-full bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              Save
            </button>
          </form>
        ) : (
          <p className="flex items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              This phone: <strong className="text-ink">{device.name}</strong>
            </span>
            <button type="button" onClick={() => setNaming(true)} className="font-bold text-brand-blue">
              Change
            </button>
          </p>
        )}
      </div>

      {(isManager || can('counter.use')) && mode === 'bunfest' && (
        <Link to="/staff/counter/door/setup" className="block text-center text-sm font-bold text-brand-blue">
          Door setup — the ticket list and prices
        </Link>
      )}
    </div>
  )
}
